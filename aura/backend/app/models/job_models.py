from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class JobStepRequest(BaseModel):
    command: str
    params: Dict[str, Any] = Field(default_factory=dict)


class JobCreateRequest(BaseModel):
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
    description: str
    status: JobStatus
    created_at: str
    updated_at: str
    progress: int = 0
    current_step: int = 0
    steps: List[JobStepRequest] = Field(default_factory=list)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    logs: List[JobLogEntry] = Field(default_factory=list)


class JobSummary(BaseModel):
    id: str
    description: str
    status: JobStatus
    progress: int
    current_step: int
    created_at: str
    updated_at: str


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

