from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.companion_models import BehaviorProfile, CompanionOverviewData


router = APIRouter(prefix="/companion", tags=["companion"])


@router.get("/overview", response_model=ApiResponse[CompanionOverviewData], dependencies=[Depends(require_bearer_token)])
async def get_companion_overview(request: Request):
    status = await request.app.state.aura_os.overview()
    projects = request.app.state.project_service.list_projects()
    voice = request.app.state.voice_pipeline.status().model_dump()
    audit_logs = request.app.state.persistence_service.get_recent_audit_logs(limit=20)
    overview = request.app.state.context_service.companion_overview(
        status={
            "status": "online",
            "auth_mode": request.app.state.settings.auth_mode,
            "services": {
                "api": "online",
                "llm": status.providers[0].details.get("health", "unknown") if status.providers else "unknown",
            },
            "jobs": {},
        },
        projects=projects,
        voice_status=voice,
        audit_logs=audit_logs,
    )
    return ApiResponse(data=overview)


@router.get("/memory", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_companion_memory(request: Request):
    return ApiResponse(data=request.app.state.context_service.memory_snapshot())


@router.get("/trust", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_companion_trust(request: Request):
    status = {
        "auth_mode": request.app.state.settings.auth_mode,
        "services": {"llm": await request.app.state.ollama_service.check_health()},
    }
    trust = request.app.state.context_service.trust_snapshot(
        status=status,
        voice_status=request.app.state.voice_pipeline.status().model_dump(),
        audit_logs=request.app.state.persistence_service.get_recent_audit_logs(limit=20),
    )
    return ApiResponse(data=trust)


@router.get("/behavior", response_model=ApiResponse[BehaviorProfile], dependencies=[Depends(require_bearer_token)])
async def get_companion_behavior(request: Request):
    return ApiResponse(data=request.app.state.behavior_service.profile())
