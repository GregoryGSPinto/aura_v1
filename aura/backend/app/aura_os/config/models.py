from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ToolDescriptor(BaseModel):
    name: str
    category: str
    description: str
    capabilities: List[str] = Field(default_factory=list)
    safe: bool = True


class ProviderStatus(BaseModel):
    name: str
    configured: bool
    available: bool
    model: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class VoiceStatus(BaseModel):
    stt_ready: bool
    tts_ready: bool
    wake_word: str = "Aura"
    pipeline_ready: bool = False
    notes: List[str] = Field(default_factory=list)


class AuraOSOverview(BaseModel):
    name: str
    version: str
    loop: List[str] = Field(default_factory=lambda: ["perceive", "reason", "plan", "act", "learn"])
    tools: List[ToolDescriptor] = Field(default_factory=list)
    providers: List[ProviderStatus] = Field(default_factory=list)
    voice: VoiceStatus
    memory: Dict[str, Any] = Field(default_factory=dict)
    agents: List[Dict[str, Any]] = Field(default_factory=list)
    model_router: Dict[str, Any] = Field(default_factory=dict)
    automation: Dict[str, Any] = Field(default_factory=dict)
    policies: Dict[str, Any] = Field(default_factory=dict)


class AuraOSExecutionRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=4000)
    auto_start: bool = False
    actor_id: str = "local-operator"


class AuraOSExecutionResponse(BaseModel):
    goal: str
    intent: str
    reasoning: str
    plan_status: str
    planned_steps: int
    job_id: Optional[str] = None
    started: bool = False
    route: Optional[Dict[str, Any]] = None
    memory_snapshot: Dict[str, Any] = Field(default_factory=dict)
    notes: List[str] = Field(default_factory=list)
