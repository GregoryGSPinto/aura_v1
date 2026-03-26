"""
WebSocket endpoint for real-time Aura events.

GET /ws/{session_id} — bidirectional WebSocket connection.
Auth via query param: ?token=<AURA_AUTH_TOKEN>

Frontend receives: chat.thinking, chat.brain_routing, chat.done,
                   health.changed, notification, etc.
Frontend can send: ping, tool.approve, tool.reject
"""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.events import AuraEvent
from app.services.websocket_manager import ws_manager

logger = logging.getLogger("aura")
router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(""),
):
    """Main Aura WebSocket endpoint for real-time events."""

    # Auth check
    auth_token = websocket.app.state.settings.auth_token
    if token != auth_token:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await ws_manager.connect(websocket, session_id)

    try:
        # Send connected confirmation
        await websocket.send_json(AuraEvent.connected(session_id))

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "ts": ""})

            elif msg_type == "tool.approve":
                # Future: approval queue
                logger.info("[WS] Tool approved: %s", data.get("approval_id"))

            elif msg_type == "tool.reject":
                logger.info("[WS] Tool rejected: %s", data.get("approval_id"))

            else:
                logger.debug("[WS] Unknown message type: %s", msg_type)

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected session=%s", session_id)
    except Exception as exc:
        logger.warning("[WS] Error session=%s: %s", session_id, exc)
    finally:
        ws_manager.disconnect(websocket, session_id)
