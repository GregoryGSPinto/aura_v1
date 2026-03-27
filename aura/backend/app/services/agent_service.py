"""
Agent Service — Orquestrador de acoes.

Integra o BrainRouter (Qwen/Claude) com o ToolRegistry.
Suporta multiplas tool calls em sequencia (agent loop).
Maximo de 10 tool calls por mensagem para evitar loops infinitos.

Dois modos:
1. INTERATIVO (Claude API): resposta rapida, tool calls via API nativa
2. BACKGROUND (Qwen local): tarefa assincrona, tool calls via prompt engineering

O BrainRouter decide qual usar baseado na complexidade.
"""

import json
import logging
import asyncio
import re
import time
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.tools.tool_registry import ToolRegistry, ToolResult
from app.services.self_mod_detector import detect_self_modification
from app.services.self_mod_planner import SelfModPlanner
from app.services.self_mod_executor import SelfModExecutor

logger = logging.getLogger("aura")

MAX_TOOL_CALLS = 10
TOOL_CALL_PATTERN = re.compile(
    r'<tool_call>\s*(\{.*?\})\s*</tool_call>',
    re.DOTALL
)


class AgentService:
    def __init__(self, tool_registry: ToolRegistry, brain_router, claude_client, ollama_service, settings, ollama_lifecycle=None):
        self.tools = tool_registry
        self.brain = brain_router
        self.claude_client = claude_client
        self.ollama_service = ollama_service
        self.settings = settings
        self.ollama_lifecycle = ollama_lifecycle
        self.active_tasks: Dict[str, dict] = {}
        self.self_mod_planner = SelfModPlanner()
        self.self_mod_executor = SelfModExecutor()

    def _build_system_prompt(self, base_prompt: str = "") -> str:
        """Constroi system prompt com tools disponiveis."""
        tools_prompt = self.tools.get_tools_prompt()
        return f"""{base_prompt}

Voce e a Aura, assistente pessoal AI do Gregory. Voce tem acesso a ferramentas para executar acoes no Mac dele.

{tools_prompt}

COMO USAR FERRAMENTAS:
Quando precisar usar uma ferramenta, responda EXATAMENTE neste formato:
<tool_call>
{{"tool": "nome_da_ferramenta", "params": {{"param1": "valor1", "param2": "valor2"}}}}
</tool_call>

Regras:
- Pode usar multiplas ferramentas em sequencia
- SEMPRE use <tool_call> tags — nao descreva o que faria, FACA
- Apos receber o resultado, continue sua resposta normalmente
- Se a ferramenta falhar, tente abordagem alternativa
- Se precisar de aprovacao (L2), explique ao Gregory o que quer fazer e por que
- NUNCA tente executar acoes L3 (financeiro, legal, delete permanente)
- Para tarefas de codigo complexas, prefira claude_code em vez de file_write
"""

    def _extract_tool_calls(self, text: str) -> List[dict]:
        """Extrai tool calls do texto do LLM."""
        calls = []
        for match in TOOL_CALL_PATTERN.finditer(text):
            try:
                parsed = json.loads(match.group(1))
                if "tool" in parsed:
                    calls.append(parsed)
            except json.JSONDecodeError:
                logger.warning(f"Tool call com JSON invalido: {match.group(1)[:200]}")
        return calls

    async def _call_claude(self, message: str, system_prompt: str, conversation_history: List[dict] = None) -> str:
        """Chama Claude API para resposta interativa."""
        messages = []
        for h in (conversation_history or []):
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        messages.append({"role": "user", "content": message})

        try:
            result = await self.claude_client.chat(
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=4096,
                temperature=0.7,
            )
            return result.get("response", "") if isinstance(result, dict) else str(result)
        except Exception as e:
            logger.error(f"Claude API error in agent: {e}")
            # Fallback to Ollama
            return await self._call_ollama(message, system_prompt)

    async def _call_ollama(self, message: str, system_prompt: str) -> str:
        """Chama Qwen local via Ollama."""
        # Auto-start Ollama se necessario
        if self.ollama_lifecycle:
            ollama_ready = await self.ollama_lifecycle.ensure_running()
            if not ollama_ready:
                logger.warning("[AgentService] Ollama nao disponivel, usando Claude API como fallback")
                return await self._call_claude(message, system_prompt)
            self.ollama_lifecycle.mark_used()

        try:
            response_text, _ = await self.ollama_service.generate_response(
                message=message,
                history=[],
                system_prompt=system_prompt,
                temperature=0.7,
                think=False,
            )
            return response_text
        except Exception as e:
            logger.error(f"Ollama error in agent: {e}")
            return f"Erro ao processar: {e}"

    async def process_message(
        self,
        message: str,
        conversation_history: List[dict] = None,
        mode: str = "interactive",
    ) -> dict:
        """
        Processa uma mensagem com capacidade de tool calling.

        Retorna:
        {
            "response": "texto final da resposta",
            "tool_calls": [{"tool": "...", "params": {...}, "result": {...}}],
            "mode": "interactive|background",
            "needs_approval": [{"approval_id": "...", "description": "..."}],
            "execution_time_ms": 1234
        }
        """
        start = time.time()

        # Detectar auto-modificação ANTES de chamar o LLM
        self_mod = detect_self_modification(message)
        if self_mod.is_self_modification and self_mod.confidence > 0.6:
            plan = await self.self_mod_planner.create_plan(message, self_mod)
            return {
                "response": plan.plan_description,
                "tool_calls": [],
                "mode": "self_modification",
                "needs_approval": [{
                    "approval_id": plan.id,
                    "description": plan.plan_description,
                    "tool": "self_modification",
                    "risk_level": plan.risk_level,
                    "files_affected": plan.files_affected,
                }],
                "execution_time_ms": (time.time() - start) * 1000,
                "self_mod_plan": {
                    "id": plan.id,
                    "request": plan.request,
                    "risk_level": plan.risk_level,
                    "requires_restart": plan.requires_restart,
                    "requires_rebuild": plan.requires_rebuild,
                    "files_affected": plan.files_affected,
                    "steps": plan.steps,
                },
            }

        system_prompt = self._build_system_prompt()
        tool_calls_log = []
        needs_approval = []
        accumulated_context = ""

        history = conversation_history or []

        for iteration in range(MAX_TOOL_CALLS + 1):
            # Construir mensagem com contexto acumulado
            if accumulated_context:
                current_message = (
                    f"{message}\n\n"
                    f"RESULTADOS DE FERRAMENTAS ANTERIORES:\n{accumulated_context}\n\n"
                    f"Continue sua resposta com base nos resultados acima."
                )
            else:
                current_message = message

            # Chamar o brain (Claude ou Qwen)
            if mode == "interactive":
                response_text = await self._call_claude(
                    message=current_message,
                    system_prompt=system_prompt,
                    conversation_history=history,
                )
            else:
                response_text = await self._call_ollama(
                    message=current_message,
                    system_prompt=system_prompt,
                )

            # Extrair tool calls
            tool_calls = self._extract_tool_calls(response_text)

            if not tool_calls:
                # Sem mais tool calls — resposta final
                # Limpar tags residuais
                clean_response = re.sub(r'</?tool_call>', '', response_text).strip()
                return {
                    "response": clean_response,
                    "tool_calls": tool_calls_log,
                    "mode": mode,
                    "needs_approval": needs_approval,
                    "execution_time_ms": (time.time() - start) * 1000,
                    "iterations": iteration,
                }

            # Executar cada tool call
            for call in tool_calls:
                tool_name = call.get("tool", "")
                params = call.get("params", {})

                logger.info(f"Agent executando tool: {tool_name} com params: {params}")

                result = await self.tools.execute(tool_name, params)

                tool_call_entry = {
                    "tool": tool_name,
                    "params": params,
                    "result": result.to_dict(),
                }
                tool_calls_log.append(tool_call_entry)

                if result.needs_approval:
                    needs_approval.append({
                        "approval_id": result.output.get("approval_id"),
                        "description": f"{tool_name}: {json.dumps(params, ensure_ascii=False)[:200]}",
                        "tool": tool_name,
                    })
                    accumulated_context += (
                        f"\n[TOOL:{tool_name}] AGUARDANDO APROVACAO — "
                        f"Acao L2 enfileirada. Gregory precisa aprovar.\n"
                    )
                else:
                    accumulated_context += f"\n{result.to_context_string()}\n"

        # Atingiu limite de iteracoes
        return {
            "response": "Atingi o limite de 10 acoes em sequencia. Posso continuar se quiser.",
            "tool_calls": tool_calls_log,
            "mode": mode,
            "needs_approval": needs_approval,
            "execution_time_ms": (time.time() - start) * 1000,
            "iterations": MAX_TOOL_CALLS,
        }

    async def process_background(self, message: str, task_id: str) -> dict:
        """Executa tarefa em background com Qwen (assincrono)."""
        self.active_tasks[task_id] = {
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "message": message,
        }

        try:
            result = await self.process_message(message, mode="background")
            self.active_tasks[task_id] = {
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "result": result,
            }
            return result
        except Exception as e:
            self.active_tasks[task_id] = {
                "status": "failed",
                "error": str(e),
            }
            raise

    def get_task_status(self, task_id: str) -> Optional[dict]:
        return self.active_tasks.get(task_id)
