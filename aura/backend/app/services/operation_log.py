"""
AURA Operation Log — in-memory circular log of the last 100 system events.

Usage:
    from app.services.operation_log import operation_log

    operation_log.add("info", "health", "Boot check completed")
    recent = operation_log.get_recent(10)
"""

from __future__ import annotations

import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class OperationLog:
    """Thread-safe, in-memory circular log (last 100 events)."""

    _MAX_EVENTS = 100

    def __init__(self) -> None:
        self._events: deque[Dict[str, Any]] = deque(maxlen=self._MAX_EVENTS)
        self._counter: int = 0
        self._lock = threading.Lock()

    # ── Public API ──────────────────────────────────────────────────────

    def add(
        self,
        type: str,
        origin: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Append an event to the log.

        Parameters
        ----------
        type : str
            One of ``"info"``, ``"warn"``, ``"error"``, ``"action"``.
        origin : str
            Service or subsystem name (e.g. ``"health"``, ``"chat"``).
        message : str
            Human-readable description of the event.
        details : dict, optional
            Arbitrary extra payload.

        Returns
        -------
        dict
            The newly created event record.
        """
        with self._lock:
            self._counter += 1
            event: Dict[str, Any] = {
                "id": self._counter,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "type": type,
                "origin": origin,
                "message": message,
                "details": details,
            }
            self._events.append(event)
        return event

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Return the last *limit* events (newest last)."""
        with self._lock:
            items = list(self._events)
        # Return the tail; deque already discards oldest beyond maxlen.
        return items[-limit:]

    def clear(self) -> None:
        """Remove all stored events (counter is NOT reset)."""
        with self._lock:
            self._events.clear()


# ── Module-level singleton ──────────────────────────────────────────────────

operation_log: OperationLog = OperationLog()
