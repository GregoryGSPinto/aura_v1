from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.models.common_models import ApiResponse


router = APIRouter()


@router.get("/status", response_model=ApiResponse[dict])
async def get_status(request: Request):
    persistence_state = request.app.state.persistence_service.get_state()
    services = {
        "api": "online",
        "llm": await request.app.state.ollama_service.check_health(),
        "filesystem": "online",
        "supabase": request.app.state.supabase_service.check_health(),
    }
    healthy = "healthy" if services["llm"] == "online" else "degraded"
    uptime = int((datetime.now(timezone.utc) - request.app.state.started_at).total_seconds())
    return ApiResponse(
        data={
            "status": healthy,
            "name": "Aura",
            "version": request.app.state.settings.version,
            "model": request.app.state.settings.model_name,
            "auth_mode": request.app.state.settings.auth_mode,
            "persistence": persistence_state.model_dump(),
            "uptime_seconds": uptime,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": services,
        }
    )
