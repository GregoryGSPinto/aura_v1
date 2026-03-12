from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


MemoryKind = Literal["session", "recent", "project", "personal", "operational", "long_term"]
PriorityLevel = Literal["urgent", "important", "active", "watch", "informational"]
RiskLevel = Literal["low", "moderate", "elevated", "high", "critical"]


class MemorySignal(BaseModel):
    id: str
    kind: MemoryKind
    title: str
    content: str
    confidence: float = 0.7
    source: str
    updated_at: str
    sensitive: bool = False


class PrioritySignal(BaseModel):
    id: str
    label: str
    description: str
    level: PriorityLevel
    source: str


class ActionPreview(BaseModel):
    command: str
    category: str
    risk_level: RiskLevel
    risk_score: int = Field(ge=0, le=5)
    requires_confirmation: bool = False
    preview: str
    side_effects: List[str] = Field(default_factory=list)
    allowed: bool = True


class TrustSignal(BaseModel):
    id: str
    label: str
    detail: str
    level: Literal["good", "attention", "warning"]
    source: str


class QuickAction(BaseModel):
    label: str
    prompt: str
    category: str


class CompanionOverviewData(BaseModel):
    greeting: str
    focus_summary: str
    founder_mode: bool = True
    behavior_mode: str
    presence_state: str
    voice_state: str
    priorities: List[PrioritySignal] = Field(default_factory=list)
    recent_projects: List[Dict[str, Any]] = Field(default_factory=list)
    memory_signals: List[MemorySignal] = Field(default_factory=list)
    trust_signals: List[TrustSignal] = Field(default_factory=list)
    pending_actions: List[ActionPreview] = Field(default_factory=list)
    quick_actions: List[QuickAction] = Field(default_factory=list)
    telemetry: Dict[str, Any] = Field(default_factory=dict)


class BehaviorProfile(BaseModel):
    name: str = "Aura"
    positioning: str
    tone: List[str] = Field(default_factory=list)
    initiative_rules: List[str] = Field(default_factory=list)
    prudence_rules: List[str] = Field(default_factory=list)
    response_modes: List[str] = Field(default_factory=list)
    gregory_mode: Dict[str, Any] = Field(default_factory=dict)

