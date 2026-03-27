"""
Engine API — Controle manual do Ollama.

O Ollama liga/desliga automaticamente, mas Gregory pode controlar manualmente.
"""

from fastapi import APIRouter, Depends, Request
from app.core.security import require_bearer_token

router = APIRouter(prefix="/engine", dependencies=[Depends(require_bearer_token)])


@router.get("/status")
async def engine_status(request: Request):
    """Status do Ollama."""
    lifecycle = request.app.state.ollama_lifecycle
    return await lifecycle.get_status()


@router.post("/start")
async def engine_start(request: Request):
    """Liga o Ollama manualmente."""
    lifecycle = request.app.state.ollama_lifecycle
    success = await lifecycle.ensure_running()
    return {"success": success, **(await lifecycle.get_status())}


@router.post("/stop")
async def engine_stop(request: Request):
    """Desliga o Ollama manualmente (libera RAM)."""
    lifecycle = request.app.state.ollama_lifecycle
    success = await lifecycle.stop()
    return {"success": success, **(await lifecycle.get_status())}
