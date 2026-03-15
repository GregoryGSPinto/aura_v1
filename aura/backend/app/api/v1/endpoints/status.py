from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.models.common_models import ApiResponse


router = APIRouter()


@router.get("/healthz", response_model=ApiResponse[dict])
async def healthz():
    return ApiResponse(
        data={
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@router.get("/status", response_model=ApiResponse[dict])
async def get_status(request: Request):
    persistence_state = request.app.state.persistence_service.get_state()
    job_stats = request.app.state.job_service.get_stats()
    ollama_service = request.app.state.ollama_service
    if hasattr(ollama_service, "health_details"):
        ollama_details = await ollama_service.health_details()
    else:
        llm_status = await ollama_service.check_health()
        ollama_details = {
            "status": llm_status,
            "url": request.app.state.settings.ollama_url,
            "model": request.app.state.settings.model_name,
            "model_available": llm_status == "online",
            "models": [],
        }
    services = {
        "api": "online",
        "llm": ollama_details["status"],
        "filesystem": "online",
        "supabase": request.app.state.supabase_service.check_health(),
    }
    healthy = "healthy" if services["llm"] == "online" and ollama_details["model_available"] else "degraded"
    uptime = int((datetime.now(timezone.utc) - request.app.state.started_at).total_seconds())
    return ApiResponse(
        data={
            "status": healthy,
            "name": "Aura",
            "version": request.app.state.settings.version,
            "model": request.app.state.settings.model_name,
            "auth_mode": request.app.state.settings.auth_mode,
            "persistence": persistence_state.model_dump(),
            "jobs": job_stats.model_dump(),
            "uptime_seconds": uptime,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": services,
            "ollama": ollama_details,
            "feature_flags": request.app.state.feature_flags,
            "startup_warnings": request.app.state.startup_warnings,
        }
    )
