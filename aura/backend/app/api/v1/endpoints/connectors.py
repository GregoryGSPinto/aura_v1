"""
Connector endpoints — Status, sync, and overview.
"""

import logging
from fastapi import APIRouter, Depends, Request
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse

logger = logging.getLogger("aura")
router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/status", dependencies=[Depends(require_bearer_token)])
async def connectors_status(request: Request):
    """Status de todos os conectores configurados."""
    connectors = {}
    for name in ("github", "calendar", "gmail"):
        connector = getattr(request.app.state, f"{name}_connector", None)
        if connector:
            try:
                configured = await connector.is_configured()
                connectors[name] = {"configured": configured, "status": "online" if configured else "not_configured"}
            except Exception as exc:
                connectors[name] = {"configured": False, "status": "error", "error": str(exc)}
        else:
            connectors[name] = {"configured": False, "status": "not_registered"}
    return ApiResponse(data={"connectors": connectors})


@router.get("/{connector_name}/sync", dependencies=[Depends(require_bearer_token)])
async def sync_connector(connector_name: str, request: Request):
    """Faz sync completo de um conector."""
    connector = getattr(request.app.state, f"{connector_name}_connector", None)
    if not connector:
        return ApiResponse(success=False, data=None, error={"code": "not_found", "message": f"Conector '{connector_name}' não encontrado."})
    try:
        configured = await connector.is_configured()
        if not configured:
            return ApiResponse(success=False, data=None, error={"code": "not_configured", "message": f"Conector '{connector_name}' não configurado."})
        result = await connector.sync()
        return ApiResponse(data=result)
    except Exception as exc:
        logger.error("[Connectors] Sync failed for %s: %s", connector_name, exc)
        return ApiResponse(success=False, data=None, error={"code": "sync_error", "message": str(exc)})


@router.get("/overview", dependencies=[Depends(require_bearer_token)])
async def connectors_overview(request: Request):
    """Resumo unificado de todos os conectores."""
    overview = {}
    for name in ("github", "calendar", "gmail"):
        connector = getattr(request.app.state, f"{name}_connector", None)
        if connector:
            try:
                configured = await connector.is_configured()
                if configured:
                    result = await connector.sync()
                    overview[name] = result
            except Exception as exc:
                overview[name] = {"error": str(exc)}
    return ApiResponse(data=overview)
