from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


RoutineTriggerType = Literal["scheduled", "app_open", "manual", "event_based"]
RoutineStatus = Literal["active", "paused"]
ExecutionStatus = Literal["success", "failed", "running"]


class RoutineAction(BaseModel):
    """Single action within a routine."""
    id: str
    type: str = Field(..., description="Action type: notify, command, open_project, git_status, etc.")
    params: Dict[str, Any] = Field(default_factory=dict)
    order: int = 0


class Routine(BaseModel):
    """A routine that can be triggered automatically or manually."""
    id: str
    name: str
    description: str = ""
    trigger_type: RoutineTriggerType = "manual"
    schedule: Optional[str] = None  # Cron expression for scheduled triggers
    actions: List[RoutineAction] = Field(default_factory=list)
    status: RoutineStatus = "active"
    is_builtin: bool = False  # Built-in routines cannot be deleted
    builtin_type: Optional[str] = None  # morning_routine, daily_summary, pending_review, project_resume
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    run_count: int = 0
    created_at: str
    updated_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RoutineExecution(BaseModel):
    """Record of a routine execution."""
    id: str
    routine_id: str
    routine_name: str
    status: ExecutionStatus
    started_at: str
    completed_at: Optional[str] = None
    results: List[Dict[str, Any]] = Field(default_factory=list)
    error_message: Optional[str] = None
    triggered_by: str = "manual"  # manual, scheduler, app_open, event
    execution_time_ms: Optional[int] = None


class RoutineCreateRequest(BaseModel):
    """Request to create a new routine."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    trigger_type: RoutineTriggerType = "manual"
    schedule: Optional[str] = None
    actions: List[RoutineAction] = Field(default_factory=list)


class RoutineUpdateRequest(BaseModel):
    """Request to update an existing routine."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    trigger_type: Optional[RoutineTriggerType] = None
    schedule: Optional[str] = None
    actions: Optional[List[RoutineAction]] = None
    status: Optional[RoutineStatus] = None


class RoutineListResponse(BaseModel):
    """Response containing list of routines."""
    routines: List[Routine]
    total: int
    active_count: int
    paused_count: int


class RoutineExecutionListResponse(BaseModel):
    """Response containing execution history."""
    executions: List[RoutineExecution]
    total: int


class RoutineTriggerResponse(BaseModel):
    """Response from triggering a routine."""
    success: bool
    execution_id: str
    message: str
    started_at: str


class RoutineToggleResponse(BaseModel):
    """Response from toggling routine status."""
    success: bool
    routine_id: str
    new_status: RoutineStatus
    message: str


class AppOpenTriggersResponse(BaseModel):
    """Response containing routines to run on app open."""
    triggered_routines: List[str]
    executions: List[RoutineExecution]
    message: str
