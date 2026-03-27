"""
Tool Registry — Framework central de ferramentas da Aura.

Toda tool registrada aqui pode ser chamada por qualquer brain (Qwen ou Claude API).
O registry mantem:
- Catalogo de tools disponiveis
- Schema de cada tool (nome, descricao, parametros, autonomia)
- Execucao com audit logging
- Classificacao L1/L2/L3 automatica

Para criar uma nova tool:
1. Crie a classe herdando de BaseTool
2. Defina name, description, parameters (JSON schema), autonomy_level
3. Implemente async def execute(self, params: dict) -> ToolResult
4. Registre no registry
"""

import asyncio
import time
import logging
import json
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime

logger = logging.getLogger("aura")


class AutonomyLevel(Enum):
    L1_AUTONOMOUS = 1      # Executa sem perguntar
    L2_APPROVAL = 2        # Pede aprovacao do Gregory
    L3_BLOCKED = 3         # NUNCA executa


@dataclass
class ToolResult:
    success: bool
    output: Any
    error: Optional[str] = None
    execution_time_ms: float = 0
    tool_name: str = ""
    autonomy_level: int = 1
    needs_approval: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)

    def to_context_string(self) -> str:
        """Formato que o LLM entende como resultado de tool."""
        if self.success:
            return f"[TOOL_RESULT:{self.tool_name}] SUCCESS\n{self.output}"
        return f"[TOOL_RESULT:{self.tool_name}] ERROR: {self.error}"


class BaseTool(ABC):
    """Classe base para todas as tools da Aura."""

    name: str = ""
    description: str = ""
    parameters: dict = {}  # JSON Schema
    autonomy_level: AutonomyLevel = AutonomyLevel.L1_AUTONOMOUS
    category: str = "general"

    def get_schema(self) -> dict:
        """Retorna schema no formato que LLMs entendem."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "autonomy_level": self.autonomy_level.value,
            "category": self.category,
        }

    @abstractmethod
    async def execute(self, params: dict) -> ToolResult:
        """Executa a tool. Implementar em cada subclasse."""
        pass

    async def validate_params(self, params: dict) -> Optional[str]:
        """Valida parametros antes de executar. Retorna erro ou None."""
        required = self.parameters.get("required", [])
        for req in required:
            if req not in params:
                return f"Parametro obrigatorio ausente: {req}"
        return None


class ToolRegistry:
    """Registro central de todas as tools da Aura."""

    def __init__(self, audit_log_path: str = "data/logs/tool_audit.jsonl"):
        self.tools: Dict[str, BaseTool] = {}
        self.audit_log_path = audit_log_path
        self.pending_approvals: Dict[str, dict] = {}
        os.makedirs(os.path.dirname(audit_log_path), exist_ok=True)

    def register(self, tool: BaseTool):
        """Registra uma tool no catalogo."""
        if not tool.name:
            raise ValueError("Tool precisa de um nome")
        self.tools[tool.name] = tool
        logger.info(f"Tool registrada: {tool.name} (L{tool.autonomy_level.value})")

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self.tools.get(name)

    def list_tools(self) -> List[dict]:
        """Lista todas as tools com seus schemas."""
        return [tool.get_schema() for tool in self.tools.values()]

    def get_tools_prompt(self) -> str:
        """Gera o bloco de prompt que descreve as tools para o LLM."""
        tools_desc = []
        for tool in self.tools.values():
            params_desc = ""
            props = tool.parameters.get("properties", {})
            required = tool.parameters.get("required", [])
            for param_name, param_info in props.items():
                req_mark = " (obrigatorio)" if param_name in required else " (opcional)"
                params_desc += f"    - {param_name}: {param_info.get('description', param_info.get('type', 'string'))}{req_mark}\n"

            tools_desc.append(
                f"  - {tool.name}: {tool.description}\n"
                f"    Autonomia: L{tool.autonomy_level.value}\n"
                f"    Parametros:\n{params_desc}"
            )
        return "FERRAMENTAS DISPONIVEIS:\n\n" + "\n".join(tools_desc)

    async def execute(self, tool_name: str, params: dict, bypass_approval: bool = False) -> ToolResult:
        """
        Executa uma tool com todos os checks.

        Fluxo:
        1. Encontra a tool
        2. Valida parametros
        3. Checa autonomia (L1=executa, L2=pede aprovacao, L3=bloqueia)
        4. Executa
        5. Loga no audit trail
        """
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                output=None,
                error=f"Tool nao encontrada: {tool_name}",
                tool_name=tool_name,
            )

        # Validar parametros
        validation_error = await tool.validate_params(params)
        if validation_error:
            return ToolResult(
                success=False,
                output=None,
                error=validation_error,
                tool_name=tool_name,
            )

        # Checar autonomia
        if tool.autonomy_level == AutonomyLevel.L3_BLOCKED:
            result = ToolResult(
                success=False,
                output=None,
                error="BLOQUEADO: Acao L3 nao pode ser executada pela Aura. Requer acao direta do Gregory.",
                tool_name=tool_name,
                autonomy_level=3,
            )
            await self._audit_log(tool_name, params, result, "BLOCKED_L3")
            return result

        if tool.autonomy_level == AutonomyLevel.L2_APPROVAL and not bypass_approval:
            # Enfileira para aprovacao
            approval_id = f"approval_{int(time.time())}_{tool_name}"
            self.pending_approvals[approval_id] = {
                "tool_name": tool_name,
                "params": params,
                "requested_at": datetime.now().isoformat(),
                "description": f"{tool.description} — {json.dumps(params, ensure_ascii=False)[:200]}",
            }
            result = ToolResult(
                success=True,
                output={"approval_id": approval_id, "message": "Acao requer aprovacao do Gregory."},
                tool_name=tool_name,
                autonomy_level=2,
                needs_approval=True,
            )
            await self._audit_log(tool_name, params, result, "PENDING_APPROVAL")
            return result

        # Executar (L1 ou L2 aprovado)
        start = time.time()
        try:
            result = await asyncio.wait_for(tool.execute(params), timeout=300)
            result.tool_name = tool_name
            result.autonomy_level = tool.autonomy_level.value
            result.execution_time_ms = (time.time() - start) * 1000
        except asyncio.TimeoutError:
            result = ToolResult(
                success=False,
                output=None,
                error="Timeout: execucao excedeu 5 minutos",
                tool_name=tool_name,
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            result = ToolResult(
                success=False,
                output=None,
                error=str(e),
                tool_name=tool_name,
                execution_time_ms=(time.time() - start) * 1000,
            )

        await self._audit_log(tool_name, params, result, "EXECUTED")
        return result

    async def approve(self, approval_id: str) -> Optional[ToolResult]:
        """Gregory aprova uma acao L2 pendente."""
        pending = self.pending_approvals.pop(approval_id, None)
        if not pending:
            return None
        return await self.execute(
            pending["tool_name"], pending["params"], bypass_approval=True
        )

    async def reject(self, approval_id: str) -> bool:
        """Gregory rejeita uma acao L2 pendente."""
        return self.pending_approvals.pop(approval_id, None) is not None

    def get_pending_approvals(self) -> List[dict]:
        """Lista acoes L2 esperando aprovacao."""
        return [
            {"id": k, **v} for k, v in self.pending_approvals.items()
        ]

    async def _audit_log(self, tool_name: str, params: dict, result: ToolResult, event: str):
        """Log de auditoria — TODA execucao e registrada."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event": event,
            "tool": tool_name,
            "params": params,
            "success": result.success,
            "execution_time_ms": result.execution_time_ms,
            "autonomy_level": result.autonomy_level,
            "error": result.error,
        }
        try:
            with open(self.audit_log_path, "a") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Falha ao escrever audit log: {e}")
