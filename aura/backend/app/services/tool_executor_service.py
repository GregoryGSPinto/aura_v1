"""
Tool Executor Service — Executa tool calls com segurança.
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger("aura")


class ToolExecutorService:

    def __init__(self, tools: dict, governance=None, permissions=None, persistence=None):
        self.tools = tools
        self.governance = governance
        self.permissions = permissions
        self.persistence = persistence

    async def execute(self, tool_call: dict, confirmed: bool = False) -> dict:
        tool_name = tool_call.get("tool", "")
        params = tool_call.get("params", {})

        security_check = self._check_security(tool_name, params)
        if security_check["blocked"]:
            return {"status": "blocked", "tool": tool_name, "result": None, "message": security_check["reason"]}

        if security_check.get("requires_confirmation") and not confirmed:
            return {
                "status": "needs_confirmation",
                "tool": tool_name,
                "result": None,
                "message": f"Ação '{tool_name}' requer confirmação.",
                "preview": {"tool": tool_name, "params": params, "risk_level": security_check.get("risk_level", "unknown")},
            }

        tool_category, tool_method = self._parse_tool_name(tool_name)
        tool_instance = self.tools.get(tool_category)

        if not tool_instance:
            return {"status": "error", "tool": tool_name, "result": None, "message": f"Tool '{tool_category}' não encontrada."}

        try:
            method = getattr(tool_instance, tool_method, None) or getattr(tool_instance, "execute", None)
            if not method:
                return {"status": "error", "tool": tool_name, "result": None, "message": f"Método '{tool_method}' não encontrado em '{tool_category}'."}

            if asyncio.iscoroutinefunction(method):
                result = await method(**params)
            else:
                result = method(**params)

            self._log_execution(tool_name, params, result, "success")
            return {"status": "executed", "tool": tool_name, "result": result, "message": f"Tool '{tool_name}' executada com sucesso."}

        except Exception as exc:
            logger.error("[ToolExecutor] Execution failed: %s — %s", tool_name, exc)
            self._log_execution(tool_name, params, str(exc), "error")
            return {"status": "error", "tool": tool_name, "result": None, "message": f"Erro ao executar '{tool_name}': {exc}"}

    def _parse_tool_name(self, tool_name: str) -> tuple:
        parts = tool_name.split(".", 1)
        return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], "execute")

    def _check_security(self, tool_name: str, params: dict) -> dict:
        blocked_tools = ["terminal.rm", "terminal.sudo", "filesystem.delete"]
        if tool_name in blocked_tools:
            return {"blocked": True, "reason": "Operação bloqueada por política de segurança."}
        high_risk_tools = ["terminal.execute", "filesystem.write"]
        if tool_name in high_risk_tools:
            return {"blocked": False, "requires_confirmation": True, "risk_level": "high"}
        elevated_tools = ["claude.execute"]
        if tool_name in elevated_tools:
            return {"blocked": False, "requires_confirmation": True, "risk_level": "elevated"}
        return {"blocked": False, "requires_confirmation": False, "risk_level": "low"}

    def _log_execution(self, tool_name: str, params: dict, result, status: str):
        try:
            if self.persistence and hasattr(self.persistence, "append_audit_log"):
                from app.models.persistence_models import AuditLogEntry
                self.persistence.append_audit_log(
                    AuditLogEntry(
                        action=f"tool:{tool_name}",
                        status=status,
                        actor="chat-router",
                        details={"params": params, "result": str(result)[:500] if result else ""},
                    )
                )
        except Exception:
            pass
