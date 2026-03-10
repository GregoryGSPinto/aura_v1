from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class CommandRequest(BaseModel):
    command: str = Field(min_length=1)
    params: Dict[str, Any] = Field(default_factory=dict)
    options: Dict[str, Any] = Field(default_factory=dict)


class CommandExecutionResult(BaseModel):
    command: str
    status: Literal["success", "blocked", "error"]
    message: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: int
    log_id: str

