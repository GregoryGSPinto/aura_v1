from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


JobStatus = Literal["pending", "planned", "queued", "running", "completed", "failed", "blocked", "cancelled"]
JobStepStatus = Literal["pending", "planned", "running", "completed", "failed", "blocked", "cancelled"]


class JobStepRequest(BaseModel):
    id: Optional[str] = None
    title: str = ""
    description: str = ""
    command: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    order: int = 0
    status: JobStepStatus = "planned"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None


class JobCreateRequest(BaseModel):
    title: Optional[str] = None
    goal: Optional[str] = None
    description: str = Field(min_length=1, max_length=2000)
    steps: List[JobStepRequest] = Field(min_length=1)


class JobLogEntry(BaseModel):
    job_id: str
    step_index: int
    timestamp: str
    level: str
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class JobRecord(BaseModel):
    id: str
    title: str
    goal: str
    description: str
    status: JobStatus
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: int = 0
    current_step: int = 0
    steps: List[JobStepRequest] = Field(default_factory=list)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    result_summary: Optional[str] = None
    error_summary: Optional[str] = None
    logs: List[JobLogEntry] = Field(default_factory=list)


class JobSummary(BaseModel):
    id: str
    title: str
    goal: str
    description: str
    status: JobStatus
    progress: int
    current_step: int
    created_at: str
    updated_at: str
    result_summary: Optional[str] = None
    error_summary: Optional[str] = None


class JobListResponse(BaseModel):
    jobs: List[JobSummary]
    total: int


class JobStats(BaseModel):
    total: int
    queued: int
    running: int
    completed: int
    failed: int
    cancelled: int
