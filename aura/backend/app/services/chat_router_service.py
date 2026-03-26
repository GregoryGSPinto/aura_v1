"""
Chat Router — Decide o caminho de cada mensagem.

Conversa simples ("oi", "como vai", "me explica X") → OllamaService (rápido)
Ação/task ("abre o projeto", "pesquisa vagas", "roda o deploy") → Agent Loop (executa tools)

Sprint 4: When the LLM emits a <tool_call>, we execute it, feed the result
back to the LLM, and return the final response with tool_calls attached.
"""

import logging
import re
import time
from typing import Any, Dict, List, Optional

from app.aura_os.config.models import AuraOSExecutionRequest
from app.tools.base import ToolResult

logger = logging.getLogger("aura")

# Maximum tool-calling re-loops to prevent infinite recursion
MAX_TOOL_LOOPS = 3


class ChatRouterService:
    """Roteia mensagens entre OllamaService (conversa) e AuraOS (ação)."""

    def __init__(
        self,
        ollama_service,
        aura_os,
        behavior_service,
        action_governance,
        tool_schema=None,
        tool_parser=None,
        tool_executor=None,
        tool_registry_v2=None,
    ):
        self.ollama = ollama_service
        self.aura_os = aura_os
        self.behavior = behavior_service
        self.governance = action_governance
        self.tool_schema = tool_schema
        self.tool_parser = tool_parser
        self.tool_executor = tool_executor
        self.tool_registry_v2 = tool_registry_v2

    async def process(self, message: str, context: dict) -> dict:
        """
        Processa mensagem do Gregory.

        Returns dict with: response, route, intent, actions_taken, plan, provider, elapsed_ms, tool_calls
        """
        intent = self._classify_intent(message)

        if self._should_use_agent(intent):
            return await self._route_to_agent(message, context, intent)
        return await self._route_to_chat(message, context, intent)

    def _classify_intent(self, message: str) -> str:
        """Classifica intenção via heurística."""
        try:
            if hasattr(self.aura_os, "reasoner") and hasattr(self.aura_os.reasoner, "analyze"):
                result = self.aura_os.reasoner.analyze(message)
                if isinstance(result, dict):
                    raw = result.get("intent", "assistant")
                    mapping = {
                        "developer": "action",
                        "system": "system",
                        "voice": "conversation",
                        "assistant": "conversation",
                    }
                    return mapping.get(raw, "conversation")
        except Exception as exc:
            logger.warning("[ChatRouter] Reasoner failed, using heuristic: %s", exc)
        return self._heuristic_classify(message)

    def _heuristic_classify(self, message: str) -> str:
        msg = message.lower().strip()

        # ── CONVERSATION PATTERNS (check FIRST — highest priority) ──
        # Questions about the external world, tutorials, how-to, tips
        # These are NEVER Aura system actions, even if they contain action verbs.
        conversation_patterns = [
            "como faço", "como eu", "como fazer", "como posso",
            "me ensina", "me explica", "me ajuda a entender",
            "o que é", "o que são", "o que significa",
            "qual a diferença", "qual é", "quais são",
            "por que", "porque", "por quê",
            "tutorial", "dica", "dicas de",
            "no iphone", "no android", "no celular", "no mac",
            "no windows", "no linux", "no navegador", "no chrome",
            "no safari", "no firefox", "no whatsapp", "no instagram",
            "no telegram", "no spotify", "no youtube",
            "receita de", "receita para",
            "como excluir", "como deletar", "como apagar",
            "como instalar", "como configurar", "como atualizar",
            "como baixar", "como ativar", "como desativar",
            "como funciona", "como usar", "como criar",
        ]

        # External-world context signals — if present, it's conversation
        external_world_signals = [
            "iphone", "android", "samsung", "xiaomi", "google",
            "apple", "microsoft", "amazon", "netflix", "spotify",
            "whatsapp", "instagram", "facebook", "twitter", "tiktok",
            "youtube", "gmail", "outlook", "telegram", "discord",
            "receita", "comida", "viagem", "saúde", "exercício",
            "filme", "série", "jogo", "música", "livro",
            "faculdade", "escola", "curso", "prova",
        ]

        for pattern in conversation_patterns:
            if pattern in msg:
                return "conversation"

        # If message looks like a question about external world topics
        if any(signal in msg for signal in external_world_signals):
            # Only treat as conversation if it's a question or request for info
            question_markers = ["?", "como", "o que", "qual", "quais", "por que", "porque", "onde", "quando"]
            if any(qm in msg for qm in question_markers):
                return "conversation"

        # ── ACTION keywords (only Aura system actions) ──
        action_keywords = [
            "abre", "abra", "open", "roda", "rode", "run", "execute", "executa",
            "cria", "crie", "create", "envia", "envie", "send", "manda",
            "instala", "install", "deploya", "deploy", "commita", "commit", "push",
            "agenda", "schedule", "configura", "configure",
            "liga", "start", "atualiza", "update", "pare", "stop",
        ]
        # ── RESEARCH keywords ──
        research_keywords = [
            "pesquisa", "pesquise", "search", "busca", "busque",
            "procura", "procure", "analisa", "analise", "compara", "compare",
        ]
        # ── SYSTEM keywords ──
        system_keywords = ["status", "health", "sistema", "versão", "version", "config"]

        # For action keywords, require word boundary match to avoid false positives
        for kw in action_keywords:
            # Use word boundary to avoid matching substrings
            if re.search(r'\b' + re.escape(kw) + r'\b', msg):
                return "action"
        for kw in research_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', msg):
                return "research"
        for kw in system_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', msg):
                return "system"
        return "conversation"

    def _should_use_agent(self, intent: str) -> bool:
        return intent in ("action", "research", "automation", "system")

    def _inject_active_project(self, system_prompt: str, context: dict) -> str:
        """Append active project context to system prompt if available."""
        active_project = context.get("active_project")
        if active_project:
            name = active_project.get("name", "unknown")
            language = active_project.get("language", "unknown")
            path = active_project.get("path", "")
            branch = active_project.get("branch", "")
            system_prompt += f"\n\nProjeto ativo: {name} ({language})\nPath: {path}\nBranch: {branch}"
        return system_prompt

    async def _route_to_chat(self, message: str, context: dict, intent: str) -> dict:
        logger.info("[ChatRouter] Route: CHAT (intent=%s)", intent)
        started = time.perf_counter()

        system_prompt = self.behavior.build_chat_prompt(
            context.get("context_summary", ""),
            context.get("memory_prompt_points", []),
            context.get("behavior_mode", "companion"),
        )

        system_prompt = self._inject_active_project(system_prompt, context)

        # Sprint 3: Inject memory context block
        memory_block = context.get("memory_context_block", "")
        if memory_block:
            system_prompt = f"{system_prompt}\n\n{memory_block}"

        # Inject tools block if available
        if self.tool_schema:
            tools_block = self.tool_schema.get_tools_prompt_block()
            system_prompt = f"{system_prompt}\n\n{tools_block}"
            logger.info("[ChatRouter] Tools block injected into system prompt (%d chars, %d tools available)",
                        len(tools_block), len(self.tool_schema.get_available_tools()))

        history = context.get("history", [])
        response_text, elapsed_ms = await self.ollama.generate_response(
            message, history, think=False, system_prompt=system_prompt,
        )

        # Sprint 4: Tool calling loop — parse, execute, re-send
        tool_calls_results: List[Dict[str, Any]] = []
        loop_history = list(history) if history else []
        loop_history.append({"role": "user", "content": message})

        for loop_idx in range(MAX_TOOL_LOOPS):
            parsed = self._parse_tool_call(response_text)
            if not parsed:
                break

            tool_name = parsed["tool"]
            tool_params = parsed.get("params", {})
            text_before = parsed.get("raw_text", "")
            logger.info("[ChatRouter] Tool call #%d: %s", loop_idx + 1, tool_name)

            # Execute via ToolRegistryV2 if available, else fallback
            tool_result = await self._execute_tool_call(tool_name, tool_params)
            tool_calls_results.append({
                "tool": tool_name,
                "params": tool_params,
                "result": tool_result,
            })

            # Build result text to feed back to the LLM
            result_output = tool_result.get("output", tool_result.get("error", "No output"))
            if isinstance(result_output, dict):
                import json
                result_output = json.dumps(result_output, ensure_ascii=False, indent=2)[:4000]
            elif isinstance(result_output, list):
                import json
                result_output = json.dumps(result_output, ensure_ascii=False, indent=2)[:4000]
            else:
                result_output = str(result_output)[:4000]

            # Add assistant turn (with tool call) + tool result to history
            loop_history.append({"role": "assistant", "content": response_text})
            tool_feedback = (
                f"<tool_result>\n"
                f"Tool: {tool_name}\n"
                f"Status: {tool_result.get('status', 'unknown')}\n"
                f"Output:\n{result_output}\n"
                f"</tool_result>\n\n"
                f"Com base no resultado acima, continue sua resposta ao usuário."
            )
            loop_history.append({"role": "user", "content": tool_feedback})

            # Re-call the LLM with the tool result
            response_text, extra_ms = await self.ollama.generate_response(
                tool_feedback,
                loop_history[:-1],  # history without the last "user" entry (it's the message)
                think=False,
                system_prompt=system_prompt,
            )
            elapsed_ms += extra_ms

        total_elapsed = int((time.perf_counter() - started) * 1000)

        return {
            "response": response_text,
            "route": "chat",
            "intent": intent,
            "actions_taken": [tc for tc in tool_calls_results if tc["result"].get("status") in ("success", "executed")],
            "plan": None,
            "provider": "ollama",
            "elapsed_ms": total_elapsed,
            "tool_calls": tool_calls_results if tool_calls_results else None,
        }

    async def _route_to_agent(self, message: str, context: dict, intent: str) -> dict:
        logger.info("[ChatRouter] Route: AGENT (intent=%s)", intent)

        # Inject active project into agent context
        active_project = context.get("active_project")
        if active_project:
            name = active_project.get("name", "unknown")
            language = active_project.get("language", "unknown")
            path = active_project.get("path", "")
            branch = active_project.get("branch", "")
            project_context = f"\n\nProjeto ativo: {name} ({language})\nPath: {path}\nBranch: {branch}"
            logger.info("[ChatRouter] Agent context enriched with active project: %s", name)
            context["_active_project_prompt"] = project_context

        if self.governance:
            # Only run governance check if intent is a concrete action, NOT conversation
            # The governance catalog maps specific action names (e.g. "vercel_deploy"),
            # NOT raw user messages. Only block if the message matches a known high-risk action.
            preview = self.governance.preview(message)
            if hasattr(preview, "allowed") and preview.allowed and hasattr(preview, "risk_score") and preview.risk_score >= 5:
                return {
                    "response": f"Essa ação está bloqueada por política de segurança (risk score: {preview.risk_score}).",
                    "route": "agent",
                    "intent": intent,
                    "actions_taken": [],
                    "plan": None,
                    "provider": "governance",
                    "elapsed_ms": 0,
                }

        try:
            request = AuraOSExecutionRequest(goal=message, auto_start=True, actor_id="chat-router")
            result = self.aura_os.execute(request)

            response_text = ""
            actions = []
            plan = None

            if hasattr(result, "reasoning"):
                response_text = result.reasoning or ""
            if hasattr(result, "notes") and result.notes:
                if response_text:
                    response_text += "\n" + "\n".join(result.notes)
                else:
                    response_text = "\n".join(result.notes)
            if hasattr(result, "planned_steps"):
                plan = {"status": getattr(result, "plan_status", None), "steps": result.planned_steps}
            if hasattr(result, "route") and result.route:
                actions.append(result.route)

            if not response_text:
                response_text = "Ação processada pelo Agent Loop."

            return {
                "response": response_text,
                "route": "agent",
                "intent": intent,
                "actions_taken": actions if isinstance(actions, list) else [actions],
                "plan": plan,
                "provider": "aura_os",
                "elapsed_ms": 0,
            }

        except Exception as exc:
            logger.error("[ChatRouter] Agent execution failed: %s", exc)
            fallback = await self._route_to_chat(message, context, intent)
            fallback["route"] = "agent_fallback"
            return fallback

    def _parse_tool_call(self, llm_response: str) -> Optional[dict]:
        """Parse tool call from LLM response using ToolCallParser."""
        if not self.tool_parser:
            return None
        return self.tool_parser.parse(llm_response)

    async def _execute_tool_call(self, tool_name: str, params: dict) -> dict:
        """Execute tool call via ToolRegistryV2 (preferred) or legacy ToolExecutorService."""
        # Try ToolRegistryV2 first (Sprint 4)
        if self.tool_registry_v2:
            try:
                result = await self.tool_registry_v2.execute(tool_name, params)
                return result.to_dict()
            except Exception as exc:
                logger.warning("[ChatRouter] ToolRegistryV2 failed for %s: %s", tool_name, exc)

        # Fallback to legacy executor
        if self.tool_executor:
            return await self.tool_executor.execute({"tool": tool_name, "params": params})

        return {"status": "error", "tool": tool_name, "error": "No tool executor available"}
