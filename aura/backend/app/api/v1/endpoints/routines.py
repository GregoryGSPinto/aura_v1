from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.routine_models import (
    AppOpenTriggersResponse,
    Routine,
    RoutineCreateRequest,
    RoutineExecution,
    RoutineExecutionListResponse,
    RoutineListResponse,
    RoutineToggleResponse,
    RoutineTriggerResponse,
    RoutineUpdateRequest,
)


router = APIRouter()


def _get_routine_service(request: Request):
    return request.app.state.routine_service


@router.get("/routines", response_model=ApiResponse[RoutineListResponse], dependencies=[Depends(require_bearer_token)])
async def list_routines(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status: active, paused"),
    trigger_type: Optional[str] = Query(None, description="Filter by trigger type: scheduled, app_open, manual, event_based"),
):
    """List all routines with optional filtering."""
    service = _get_routine_service(request)
    routines = service.list_routines(status=status, trigger_type=trigger_type)
    
    return ApiResponse(
        data=RoutineListResponse(
            routines=routines,
            total=len(routines),
            active_count=sum(1 for r in routines if r.status == "active"),
            paused_count=sum(1 for r in routines if r.status == "paused"),
        )
    )


@router.post("/routines", response_model=ApiResponse[Routine], dependencies=[Depends(require_bearer_token)])
async def create_routine(request_body: RoutineCreateRequest, request: Request):
    """Create a new routine."""
    service = _get_routine_service(request)
    routine = service.create_routine(request_body)
    return ApiResponse(data=routine)


@router.get("/routines/{routine_id}", response_model=ApiResponse[Routine], dependencies=[Depends(require_bearer_token)])
async def get_routine(routine_id: str, request: Request):
    """Get a specific routine by ID."""
    service = _get_routine_service(request)
    routine = service.get_routine(routine_id)
    return ApiResponse(data=routine)


@router.put("/routines/{routine_id}", response_model=ApiResponse[Routine], dependencies=[Depends(require_bearer_token)])
async def update_routine(routine_id: str, request_body: RoutineUpdateRequest, request: Request):
    """Update an existing routine."""
    service = _get_routine_service(request)
    routine = service.update_routine(routine_id, request_body)
    return ApiResponse(data=routine)


@router.delete("/routines/{routine_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def delete_routine(routine_id: str, request: Request):
    """Delete a routine."""
    service = _get_routine_service(request)
    service.delete_routine(routine_id)
    return ApiResponse(data={"deleted": True, "routine_id": routine_id})


@router.post("/routines/{routine_id}/trigger", response_model=ApiResponse[RoutineTriggerResponse], dependencies=[Depends(require_bearer_token)])
async def trigger_routine(routine_id: str, request: Request):
    """Manually trigger a routine."""
    service = _get_routine_service(request)
    execution = service.trigger_routine(routine_id, triggered_by="manual")
    return ApiResponse(
        data=RoutineTriggerResponse(
            success=execution.status == "success",
            execution_id=execution.id,
            message=f"Routine '{execution.routine_name}' triggered successfully" if execution.status == "success" else f"Routine failed: {execution.error_message}",
            started_at=execution.started_at,
        )
    )


@router.post("/routines/{routine_id}/toggle", response_model=ApiResponse[RoutineToggleResponse], dependencies=[Depends(require_bearer_token)])
async def toggle_routine(routine_id: str, request: Request):
    """Toggle routine between active and paused."""
    service = _get_routine_service(request)
    routine = service.toggle_routine(routine_id)
    return ApiResponse(
        data=RoutineToggleResponse(
            success=True,
            routine_id=routine.id,
            new_status=routine.status,  # type: ignore[arg-type]
            message=f"Routine '{routine.name}' is now {routine.status}",
        )
    )


@router.get("/routines/{routine_id}/history", response_model=ApiResponse[RoutineExecutionListResponse], dependencies=[Depends(require_bearer_token)])
async def get_routine_history(
    routine_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
):
    """Get execution history for a specific routine."""
    service = _get_routine_service(request)
    executions = service.get_execution_history(routine_id=routine_id, limit=limit)
    return ApiResponse(
        data=RoutineExecutionListResponse(
            executions=executions,
            total=len(executions),
        )
    )


@router.get("/routines/executions/recent", response_model=ApiResponse[RoutineExecutionListResponse], dependencies=[Depends(require_bearer_token)])
async def get_recent_executions(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
):
    """Get recent execution history across all routines."""
    service = _get_routine_service(request)
    executions = service.get_execution_history(limit=limit)
    return ApiResponse(
        data=RoutineExecutionListResponse(
            executions=executions,
            total=len(executions),
        )
    )


@router.get("/routines/triggers/app-open", response_model=ApiResponse[AppOpenTriggersResponse], dependencies=[Depends(require_bearer_token)])
async def trigger_app_open_routines(request: Request):
    """Trigger all app_open routines. Called when the application opens."""
    service = _get_routine_service(request)
    executions = service.trigger_app_open_routines()
    triggered = [e.routine_id for e in executions if e.status in ("success", "running")]
    
    return ApiResponse(
        data=AppOpenTriggersResponse(
            triggered_routines=triggered,
            executions=executions,
            message=f"Triggered {len(triggered)} app_open routine(s)",
        )
    )


@router.get("/executions/{execution_id}", response_model=ApiResponse[RoutineExecution], dependencies=[Depends(require_bearer_token)])
async def get_execution(execution_id: str, request: Request):
    """Get a specific execution by ID."""
    service = _get_routine_service(request)
    execution = service.get_execution(execution_id)
    return ApiResponse(data=execution)
