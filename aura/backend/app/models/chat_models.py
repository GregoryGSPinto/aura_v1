from typing import List, Literal, Optional

from pydantic import BaseModel, Field


IntentType = Literal["conversa", "consulta", "acao"]


class ChatHistoryItem(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str
    timestamp: Optional[str] = None


class ChatContext(BaseModel):
    project_id: Optional[str] = None
    session_id: str = "default-session"
    history: List[ChatHistoryItem] = Field(default_factory=list)


class ChatOptions(BaseModel):
    stream: bool = False
    temperature: float = 0.2
    think: bool = False


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context: ChatContext = Field(default_factory=ChatContext)
    options: ChatOptions = Field(default_factory=ChatOptions)


class SuggestedAction(BaseModel):
    command: str
    reason: str


class ChatResponseData(BaseModel):
    response: str
    intent: IntentType
    action_taken: Optional[dict] = None
    suggested_action: Optional[SuggestedAction] = None
    session_id: str
    processing_time_ms: int
    model: str
    persistence_mode: Optional[str] = None
