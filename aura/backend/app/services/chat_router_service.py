"""
Chat Router — Decide o caminho de cada mensagem.

Conversa simples ("oi", "como vai", "me explica X") → OllamaService (rápido)
Ação/task ("abre o projeto", "pesquisa vagas", "roda o deploy") → Agent Loop (executa tools)
"""

import logging
from typing import Optional

from app.aura_os.config.models import AuraOSExecutionRequest

logger = logging.getLogger("aura")


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
    ):
        self.ollama = ollama_service
        self.aura_os = aura_os
        self.behavior = behavior_service
        self.governance = action_governance
        self.tool_schema = tool_schema
        self.tool_parser = tool_parser
        self.tool_executor = tool_executor

    async def process(self, message: str, context: dict) -> dict:
        """
        Processa mensagem do Gregory.

        Returns dict with: response, route, intent, actions_taken, plan, provider, elapsed_ms
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

        action_keywords = [
            "abre", "abra", "open", "roda", "rode", "run", "execute", "executa",
            "cria", "crie", "create", "envia", "envie", "send", "manda",
            "instala", "install", "deploya", "deploy", "commita", "commit", "push",
            "agenda", "schedule", "configura", "configure", "para", "stop",
            "liga", "start", "atualiza", "update",
        ]
        research_keywords = [
            "pesquisa", "pesquise", "search", "busca", "busque",
            "procura", "procure", "analisa", "analise", "compara", "compare",
        ]
        system_keywords = ["status", "health", "sistema", "versão", "version", "config"]

        for kw in action_keywords:
            if kw in msg:
                return "action"
        for kw in research_keywords:
            if kw in msg:
                return "research"
        for kw in system_keywords:
            if kw in msg:
                return "system"
        return "conversation"

    def _should_use_agent(self, intent: str) -> bool:
        return intent in ("action", "research", "automation", "system")

    async def _route_to_chat(self, message: str, context: dict, intent: str) -> dict:
        logger.info("[ChatRouter] Route: CHAT (intent=%s)", intent)

        system_prompt = self.behavior.build_chat_prompt(
            context.get("context_summary", ""),
            context.get("memory_prompt_points", []),
            context.get("behavior_mode", "companion"),
        )

        # Inject tools block if available
        if self.tool_schema:
            tools_block = self.tool_schema.get_tools_prompt_block()
            system_prompt = f"{system_prompt}\n\n{tools_block}"

        history = context.get("history", [])
        response_text, elapsed_ms = await self.ollama.generate_response(
            message, history, think=False, system_prompt=system_prompt,
        )

        # Check for tool calls in response
        tool_result = await self._maybe_execute_tool(response_text)
        if tool_result:
            return {
                "response": tool_result.get("message", response_text),
                "route": "chat",
                "intent": intent,
                "actions_taken": [tool_result] if tool_result.get("status") == "executed" else [],
                "plan": None,
                "provider": "ollama",
                "elapsed_ms": elapsed_ms,
                "tool_call": tool_result,
            }

        return {
            "response": response_text,
            "route": "chat",
            "intent": intent,
            "actions_taken": [],
            "plan": None,
            "provider": "ollama",
            "elapsed_ms": elapsed_ms,
        }

    async def _route_to_agent(self, message: str, context: dict, intent: str) -> dict:
        logger.info("[ChatRouter] Route: AGENT (intent=%s)", intent)

        if self.governance:
            preview = self.governance.preview(message)
            if hasattr(preview, "risk_score") and preview.risk_score >= 5:
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

    async def _maybe_execute_tool(self, llm_response: str) -> Optional[dict]:
        """Parse and execute tool call from LLM response if present."""
        if not self.tool_parser or not self.tool_executor:
            return None
        tool_call = self.tool_parser.parse(llm_response)
        if not tool_call:
            return None
        logger.info("[ChatRouter] Tool call detected: %s", tool_call.get("tool"))
        return await self.tool_executor.execute(tool_call)
