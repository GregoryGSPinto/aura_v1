"""
AURA Tool Registry V2 — Central registry for all tools with execute, list, history.

This is the Sprint 4 unified registry that wraps all individual tools,
providing a single execute() entry point with audit logging and WS events.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

from app.tools.base import RiskLevel, ToolResult, ToolStatus

logger = logging.getLogger("aura")

# Maximum history entries to keep in memory
MAX_HISTORY = 200


class ToolDescriptorV2:
    """Describes a registered tool for discovery endpoints."""

    def __init__(
        self,
        name: str,
        description: str,
        risk_level: RiskLevel = RiskLevel.FREE,
        parameters: Optional[Dict[str, Any]] = None,
        requires_confirmation: bool = False,
    ):
        self.name = name
        self.description = description
        self.risk_level = risk_level
        self.parameters = parameters or {}
        self.requires_confirmation = requires_confirmation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "risk_level": self.risk_level.value,
            "parameters": self.parameters,
            "requires_confirmation": self.requires_confirmation,
        }


class ToolRegistryV2:
    """
    Central registry for Sprint 4 tools.

    Wraps individual tool instances and provides:
    - execute(tool_name, params, session_id) → ToolResult
    - list_tools() → list of tool descriptors
    - get_history(limit) → recent executions
    """

    def __init__(self):
        self._tools: Dict[str, Any] = {}
        self._descriptors: Dict[str, ToolDescriptorV2] = {}
        self._history: Deque[Dict[str, Any]] = deque(maxlen=MAX_HISTORY)

    def register(
        self,
        name: str,
        instance: Any,
        description: str = "",
        risk_level: RiskLevel = RiskLevel.FREE,
        parameters: Optional[Dict[str, Any]] = None,
        requires_confirmation: bool = False,
    ) -> None:
        self._tools[name] = instance
        self._descriptors[name] = ToolDescriptorV2(
            name=name,
            description=description,
            risk_level=risk_level,
            parameters=parameters,
            requires_confirmation=requires_confirmation,
        )

    def list_tools(self) -> List[Dict[str, Any]]:
        return [desc.to_dict() for desc in self._descriptors.values()]

    def get_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        items = list(self._history)
        items.reverse()
        return items[:limit]

    async def execute(
        self,
        tool_name: str,
        params: Dict[str, Any],
        session_id: Optional[str] = None,
    ) -> ToolResult:
        """
        Execute a tool by name.

        tool_name format: "category.method" (e.g., "git.status", "terminal.execute")
        """
        t0 = time.time()

        # Parse category.method
        parts = tool_name.split(".", 1)
        category = parts[0]
        method_name = parts[1] if len(parts) == 2 else "execute"

        tool_instance = self._tools.get(category)
        if not tool_instance:
            result = ToolResult.fail(tool_name, f"Tool '{category}' not registered")
            self._record(tool_name, params, result, session_id)
            return result

        method = getattr(tool_instance, method_name, None)
        if not method:
            result = ToolResult.fail(tool_name, f"Method '{method_name}' not found on '{category}'")
            self._record(tool_name, params, result, session_id)
            return result

        # Emit tool.started WS event
        await self._emit_started(tool_name, params, session_id)

        try:
            if asyncio.iscoroutinefunction(method):
                result = await asyncio.wait_for(method(**params), timeout=30.0)
            else:
                result = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: method(**params),
                )

            # Wrap non-ToolResult returns
            if not isinstance(result, ToolResult):
                result = ToolResult(
                    tool_name=tool_name,
                    status=ToolStatus.SUCCESS,
                    started_at=t0,
                    finished_at=time.time(),
                    output=result if not isinstance(result, dict) else result,
                    risk_level=RiskLevel.FREE,
                )

        except asyncio.TimeoutError:
            result = ToolResult(
                tool_name=tool_name,
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error="Tool execution timed out (30s)",
            )
        except Exception as exc:
            logger.error("[ToolRegistryV2] Execution failed: %s — %s", tool_name, exc)
            result = ToolResult(
                tool_name=tool_name,
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
            )

        self._record(tool_name, params, result, session_id)
        await self._emit_completed(tool_name, result, session_id)
        return result

    def _record(
        self,
        tool_name: str,
        params: Dict[str, Any],
        result: ToolResult,
        session_id: Optional[str],
    ) -> None:
        self._history.append({
            "tool": tool_name,
            "params": _safe_params(params),
            "status": result.status.value,
            "duration_ms": result.duration_ms,
            "error": result.error,
            "session_id": session_id,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

    async def _emit_started(
        self, tool_name: str, params: Dict[str, Any], session_id: Optional[str]
    ) -> None:
        try:
            from app.services.events import AuraEvent
            from app.services.websocket_manager import ws_manager

            event = AuraEvent.tool_started(tool_name, _safe_params(params))
            if session_id:
                await ws_manager.send_to_session(session_id, event)
            else:
                await ws_manager.broadcast(event)
        except Exception:
            pass

    async def _emit_completed(
        self, tool_name: str, result: ToolResult, session_id: Optional[str]
    ) -> None:
        try:
            from app.services.events import AuraEvent
            from app.services.websocket_manager import ws_manager

            event = AuraEvent.tool_completed(tool_name, result.to_dict())
            if session_id:
                await ws_manager.send_to_session(session_id, event)
            else:
                await ws_manager.broadcast(event)
        except Exception:
            pass


def _safe_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """Truncate large param values for history storage."""
    safe = {}
    for k, v in params.items():
        if isinstance(v, str) and len(v) > 500:
            safe[k] = v[:500] + "..."
        else:
            safe[k] = v
    return safe
