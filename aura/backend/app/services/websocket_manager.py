"""
WebSocket Connection Manager — manages all real-time connections.

Provides session-scoped and broadcast messaging for Aura events.
Singleton instance: ws_manager
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket

logger = logging.getLogger("aura")


class ConnectionManager:
    """Manages WebSocket connections grouped by session_id."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.broadcast_connections: Set[WebSocket] = set()

    @property
    def connection_count(self) -> int:
        return len(self.broadcast_connections)

    async def connect(self, websocket: WebSocket, session_id: str = "default") -> None:
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        self.broadcast_connections.add(websocket)
        logger.info("[WS] Connected session=%s (total=%d)", session_id, self.connection_count)

    def disconnect(self, websocket: WebSocket, session_id: str = "default") -> None:
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        self.broadcast_connections.discard(websocket)
        logger.info("[WS] Disconnected session=%s (total=%d)", session_id, self.connection_count)

    async def send_to_session(self, session_id: str, event: Dict[str, Any]) -> None:
        """Send event to all connections in a session."""
        connections = self.active_connections.get(session_id)
        if not connections:
            return
        dead: Set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(event)
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.discard(ws)
            self.broadcast_connections.discard(ws)

    async def broadcast(self, event: Dict[str, Any]) -> None:
        """Send event to ALL active connections."""
        dead: Set[WebSocket] = set()
        for ws in self.broadcast_connections:
            try:
                await ws.send_json(event)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.broadcast_connections.discard(ws)
            # Also remove from session maps
            for session_set in self.active_connections.values():
                session_set.discard(ws)


# Module-level singleton
ws_manager = ConnectionManager()
