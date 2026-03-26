"""
Aura Event Types — structured events emitted via WebSocket.

All events follow the pattern: {"type": "domain.action", ...payload}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class AuraEvent:
    """Factory for all WebSocket event payloads."""

    # ── Chat events ──────────────────────────────────────────────

    @staticmethod
    def chat_thinking(session_id: str) -> Dict[str, Any]:
        return {"type": "chat.thinking", "session_id": session_id, "ts": _ts()}

    @staticmethod
    def chat_brain_routing(
        session_id: str, target: str, complexity: int, reason: str
    ) -> Dict[str, Any]:
        return {
            "type": "chat.brain_routing",
            "session_id": session_id,
            "target": target,
            "complexity": complexity,
            "reason": reason,
            "ts": _ts(),
        }

    @staticmethod
    def chat_executing(session_id: str, tool: str, action: str) -> Dict[str, Any]:
        return {
            "type": "chat.executing",
            "session_id": session_id,
            "tool": tool,
            "action": action,
            "ts": _ts(),
        }

    @staticmethod
    def chat_chunk(session_id: str, chunk: str) -> Dict[str, Any]:
        return {"type": "chat.chunk", "session_id": session_id, "chunk": chunk}

    @staticmethod
    def chat_done(session_id: str, response: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "chat.done",
            "session_id": session_id,
            "response": response,
            "ts": _ts(),
        }

    # ── Tool events ──────────────────────────────────────────────

    @staticmethod
    def tool_started(tool: str, params: Dict[str, Any]) -> Dict[str, Any]:
        return {"type": "tool.started", "tool": tool, "params": params, "ts": _ts()}

    @staticmethod
    def tool_completed(tool: str, result: Dict[str, Any]) -> Dict[str, Any]:
        return {"type": "tool.completed", "tool": tool, "result": result, "ts": _ts()}

    @staticmethod
    def tool_needs_approval(
        approval_id: str, tool: str, params: Dict[str, Any], risk: str
    ) -> Dict[str, Any]:
        return {
            "type": "tool.needs_approval",
            "approval_id": approval_id,
            "tool": tool,
            "params": params,
            "risk_level": risk,
            "ts": _ts(),
        }

    # ── Health events ────────────────────────────────────────────

    @staticmethod
    def health_changed(
        service: str, old_status: str, new_status: str
    ) -> Dict[str, Any]:
        return {
            "type": "health.changed",
            "service": service,
            "old_status": old_status,
            "new_status": new_status,
            "ts": _ts(),
        }

    # ── Notification events ──────────────────────────────────────

    @staticmethod
    def notification(
        title: str, message: str, level: str = "info", action: Optional[Dict] = None
    ) -> Dict[str, Any]:
        return {
            "type": "notification",
            "title": title,
            "message": message,
            "level": level,
            "action": action,
            "ts": _ts(),
        }

    # ── System events ────────────────────────────────────────────

    @staticmethod
    def connected(session_id: str) -> Dict[str, Any]:
        return {"type": "connected", "session_id": session_id, "ts": _ts()}
