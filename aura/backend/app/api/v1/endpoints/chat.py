from fastapi import APIRouter, Depends, Request
from typing import Optional

from app.core.security import require_bearer_token
from app.models.chat_models import ChatRequest, ChatResponseData, SuggestedAction
from app.models.command_models import CommandExecutionResult
from app.models.common_models import ApiResponse
from app.models.persistence_models import ChatMessageRecord, ChatSessionRecord


router = APIRouter()


def classify_intent(message: str) -> str:
    lowered = message.lower()
    action_verbs = ["abr", "rode", "execut", "deploy", "status do git", "log", "abra"]
    consult_terms = ["qual", "quais", "listar", "status", "mostre", "consulta"]
    if any(term in lowered for term in action_verbs):
        return "acao"
    if any(term in lowered for term in consult_terms):
        return "consulta"
    return "conversa"


def suggest_action(message: str) -> Optional[SuggestedAction]:
    lowered = message.lower()
    if "abrir projeto" in lowered or "abra o projeto" in lowered:
        return SuggestedAction(command="open_project", reason="Solicitação explícita para abrir um projeto.")
    if "git" in lowered and "status" in lowered:
        return SuggestedAction(command="git_status", reason="Pedido de status operacional de repositório.")
    return None


@router.post("/chat", response_model=ApiResponse[ChatResponseData], dependencies=[Depends(require_bearer_token)])
async def chat(request_body: ChatRequest, request: Request):
    auth_context = getattr(request.state, "auth_context", {})
    intent = classify_intent(request_body.message)
    tool_route = request.app.state.tool_router.route(
        request_body.message,
        request.app.state.project_service.list_projects(),
    )
    if tool_route and intent == "conversa":
        intent = "consulta"
    action_taken: Optional[dict] = None

    response, elapsed_ms = await request.app.state.ollama_service.generate_response(
        message=request_body.message,
        history=request_body.context.history,
        temperature=request_body.options.temperature,
        think=request_body.options.think,
    )

    if tool_route:
        command_result: CommandExecutionResult = request.app.state.command_service.execute(
            tool_route.command,
            tool_route.params,
            actor={"user_id": auth_context.get("user_id") or "chat-router", "provider": "chat"},
        )
        action_taken = {
            "command": command_result.command,
            "params": tool_route.params,
            "status": command_result.status,
            "result": {
                "message": command_result.message,
                "stdout": command_result.stdout,
                "stderr": command_result.stderr,
                "metadata": command_result.metadata,
            },
        }
        extra_context = command_result.stdout or command_result.message or ""
        if extra_context:
            response = f"{response}\n\nResultado operacional:\n{extra_context[:1200]}".strip()

    request.app.state.persistence_service.upsert_chat_session(
        ChatSessionRecord(
            session_id=request_body.context.session_id,
            user_id=auth_context.get("user_id"),
            project_id=request_body.context.project_id,
            metadata={"source": "api.chat"},
        )
    )
    request.app.state.persistence_service.append_chat_messages(
        [
            ChatMessageRecord(
                session_id=request_body.context.session_id,
                role="user",
                content=request_body.message,
                metadata={"history_size": len(request_body.context.history)},
            ),
            ChatMessageRecord(
                session_id=request_body.context.session_id,
                role="assistant",
                content=response,
                model=request.app.state.settings.model_name,
                intent=intent,
            ),
        ]
    )
    data = ChatResponseData(
        response=response,
        intent=intent,  # type: ignore[arg-type]
        action_taken=action_taken,
        suggested_action=suggest_action(request_body.message) if not action_taken else None,
        session_id=request_body.context.session_id,
        processing_time_ms=elapsed_ms,
        model=request.app.state.settings.model_name,
        persistence_mode=request.app.state.persistence_service.get_state().mode,
    )
    return ApiResponse(data=data)
