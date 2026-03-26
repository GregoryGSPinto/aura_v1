"""
Sprint 5 — Claude Mission API endpoints.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/claude", tags=["claude"])


class CreateMissionRequest(BaseModel):
    objective: str = Field(min_length=1, max_length=2000)
    project_slug: str = Field(min_length=1)
    working_dir: Optional[str] = None
    context: str = ""
    preferences: Optional[Dict[str, str]] = None


class RetryMissionRequest(BaseModel):
    extra_context: str = ""


@router.post(
    "/mission",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def create_mission(body: CreateMissionRequest, request: Request):
    """Create a new Claude Code mission."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        raise AuraError("claude_bridge_unavailable", "Claude Bridge not initialized.", status_code=503)

    working_dir = body.working_dir or request.app.state.settings.base_project_dir
    mission = await bridge.create_mission(
        objective=body.objective,
        project_slug=body.project_slug,
        working_dir=working_dir,
        context=body.context,
        preferences=body.preferences,
    )
    return ApiResponse(data=mission.to_dict())


@router.post(
    "/mission/{mission_id}/execute",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def execute_mission(mission_id: str, request: Request):
    """Execute a queued mission."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        raise AuraError("claude_bridge_unavailable", "Claude Bridge not initialized.", status_code=503)
    try:
        mission = await bridge.execute_mission(mission_id)
    except KeyError:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    except ValueError as exc:
        raise AuraError("mission_invalid_state", str(exc), status_code=409)
    return ApiResponse(data=mission.to_dict())


@router.get(
    "/mission/{mission_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def get_mission(mission_id: str, request: Request):
    """Get mission status and details."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        raise AuraError("claude_bridge_unavailable", "Claude Bridge not initialized.", status_code=503)
    try:
        mission = await bridge.get_mission_status(mission_id)
    except KeyError:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    return ApiResponse(data=mission.to_dict())


@router.get(
    "/missions",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def list_missions(
    request: Request,
    project_slug: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
):
    """List missions with optional filters."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        return ApiResponse(data=[])
    missions = await bridge.list_missions(
        project_slug=project_slug,
        status=status,
        limit=min(limit, 100),
    )
    return ApiResponse(data=missions)


@router.post(
    "/mission/{mission_id}/cancel",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def cancel_mission(mission_id: str, request: Request):
    """Cancel a running or queued mission."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        raise AuraError("claude_bridge_unavailable", "Claude Bridge not initialized.", status_code=503)
    cancelled = await bridge.cancel_mission(mission_id)
    if not cancelled:
        raise AuraError("mission_cancel_failed", "Mission cannot be cancelled.", status_code=409)
    return ApiResponse(data={"mission_id": mission_id, "cancelled": True})


@router.post(
    "/mission/{mission_id}/retry",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def retry_mission(mission_id: str, body: RetryMissionRequest, request: Request):
    """Retry a failed mission."""
    bridge = getattr(request.app.state, "claude_bridge", None)
    if not bridge:
        raise AuraError("claude_bridge_unavailable", "Claude Bridge not initialized.", status_code=503)
    try:
        mission = await bridge.get_mission_status(mission_id)
    except KeyError:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    if mission.status != "failed":
        raise AuraError("mission_invalid_state", "Only failed missions can be retried.", status_code=409)
    mission.status = "queued"
    mission.retry_count += 1
    bridge.queue.append(mission_id)
    result = await bridge.execute_mission(mission_id)
    return ApiResponse(data=result.to_dict())
