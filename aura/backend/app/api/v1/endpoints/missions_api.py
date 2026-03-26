"""
Sprint 7 — Mission Engine V1 API endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/missions", tags=["missions"])


class CreateMissionRequest(BaseModel):
    objective: str = Field(min_length=1, max_length=2000)
    project: Optional[str] = None


def _get_engine(request: Request):
    planner = getattr(request.app.state, "mission_planner", None)
    executor = getattr(request.app.state, "mission_executor", None)
    store = getattr(request.app.state, "mission_store", None)
    if not planner or not executor or not store:
        raise AuraError("mission_engine_unavailable", "Mission engine not initialized.", status_code=503)
    return planner, executor, store


@router.post("", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_mission(body: CreateMissionRequest, request: Request):
    """Create and plan a new mission."""
    planner, executor, store = _get_engine(request)
    mission = await planner.plan(body.objective, project_slug=body.project)
    store.save(mission)
    return ApiResponse(data=mission.to_dict())


@router.post("/{mission_id}/execute", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def execute_mission(mission_id: str, request: Request):
    """Execute a planned mission."""
    planner, executor, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    result = await executor.execute(mission)
    store.save(result)
    return ApiResponse(data=result.to_dict())


@router.get("/{mission_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_mission(mission_id: str, request: Request):
    """Get mission details."""
    _, _, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    return ApiResponse(data=mission.to_dict())


@router.get("/{mission_id}/progress", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_mission_progress(mission_id: str, request: Request):
    """Get mission progress."""
    _, _, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    d = mission.to_dict()
    current_step = None
    for s in mission.steps:
        if s.status.value == "running":
            current_step = s.to_dict()
            break
    elapsed = (mission.finished_at or __import__("time").time()) - (mission.started_at or mission.created_at)
    return ApiResponse(data={
        "mission_id": mission.id,
        "objective": mission.objective,
        "status": mission.status.value,
        "total_steps": d["total_steps"],
        "completed_steps": d["completed_steps"],
        "progress_percent": d["progress_percent"],
        "current_step": current_step,
        "artifacts": mission.artifacts,
        "elapsed_seconds": round(elapsed, 1),
    })


@router.post("/{mission_id}/pause", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def pause_mission(mission_id: str, request: Request):
    _, executor, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    result = await executor.pause(mission)
    store.save(result)
    return ApiResponse(data=result.to_dict())


@router.post("/{mission_id}/resume", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def resume_mission(mission_id: str, request: Request):
    _, executor, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    result = await executor.resume(mission)
    store.save(result)
    return ApiResponse(data=result.to_dict())


@router.post("/{mission_id}/cancel", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def cancel_mission(mission_id: str, request: Request):
    _, executor, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    result = await executor.cancel(mission)
    store.save(result)
    return ApiResponse(data=result.to_dict())


@router.post("/{mission_id}/steps/{step_id}/approve", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def approve_step(mission_id: str, step_id: str, request: Request):
    _, executor, store = _get_engine(request)
    mission = store.get(mission_id)
    if not mission:
        raise AuraError("mission_not_found", f"Mission {mission_id} not found.", status_code=404)
    result = await executor.approve_step(mission, step_id)
    store.save(result)
    return ApiResponse(data=result.to_dict())


@router.get("", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_missions(request: Request, project: Optional[str] = None, status: Optional[str] = None, limit: int = 20):
    _, _, store = _get_engine(request)
    return ApiResponse(data=store.list_missions(project_slug=project, status=status, limit=min(limit, 100)))


@router.get("/active", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_active_mission(request: Request):
    _, _, store = _get_engine(request)
    running = store.list_missions(status="running", limit=1)
    if running:
        return ApiResponse(data=running[0])
    return ApiResponse(data=None)
