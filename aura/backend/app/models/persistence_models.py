from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


StorageMode = Literal["local", "supabase", "fallback-local"]


class AuditLogEntry(BaseModel):
    log_id: str
    timestamp: str
    command: str
    status: str
    params: Dict[str, Any] = Field(default_factory=dict)
    stdout: str = ""
    stderr: str = ""
    actor_id: Optional[str] = None
    request_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatSessionRecord(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatMessageRecord(BaseModel):
    session_id: str
    role: str
    content: str
    model: Optional[str] = None
    intent: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PersistenceState(BaseModel):
    mode: StorageMode
    supabase_enabled: bool
    supabase_configured: bool
    auth_mode: str
    warnings: List[str] = Field(default_factory=list)
