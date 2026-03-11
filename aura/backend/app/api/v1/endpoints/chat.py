import time
from typing import Optional

from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.models.chat_models import ChatRequest, ChatResponseData, SuggestedAction
from app.models.command_models import CommandExecutionResult
from app.models.common_models import ApiResponse
from app.models.persistence_models import ChatMessageRecord, ChatSessionRecord
from app.tools.tool_router import ToolAnalysis


router = APIRouter()


def classify_intent(message: str) -> str:
    lowered = message.lower()
    action_verbs = ["abr", "rode", "rodar", "execut", "deploy", "status do git", "log", "abra", "open", "launch"]
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


def build_operational_response(analysis: ToolAnalysis, command_result: Optional[CommandExecutionResult] = None) -> str:
    if analysis.status == "blocked":
        return "Entendi o pedido como uma ação operacional, mas ele está bloqueado pela política de segurança da Aura."

    if analysis.status == "unimplemented":
        return "Entendi o pedido como uma ação operacional, mas essa ação ainda não foi implementada na Aura."

    if not command_result:
        return "A solicitação operacional foi identificada, mas não houve execução."

    command = command_result.command
    if command == "open_terminal":
        return "Sim. Essa é uma ação operacional permitida. Vou abrir o Terminal."
    if command == "open_vscode":
        return "Sim. Essa é uma ação operacional permitida. Vou abrir o VS Code."
    if command == "open_project":
        return f"Sim. Essa é uma ação operacional permitida. {command_result.message}"

    parts = [command_result.message]
    summary = summarize_command_result(command_result)
    if summary:
        parts.append(summary)
    return "\n\n".join(part for part in parts if part).strip()


def summarize_command_result(command_result: CommandExecutionResult) -> str:
    if command_result.command == "list_projects":
        projects = command_result.metadata.get("projects", [])
        names = [item.get("name") for item in projects if isinstance(item, dict) and item.get("name")]
        if names:
            return "Projetos disponíveis: " + ", ".join(names[:10])

    if command_result.stdout:
        return command_result.stdout[:1200]

    metadata = command_result.metadata or {}
    if metadata:
        visible_items = [f"{key}: {value}" for key, value in metadata.items() if key not in {"projects"}]
        if visible_items:
            return "\n".join(visible_items[:8])

    return ""


@router.post("/chat", response_model=ApiResponse[ChatResponseData], dependencies=[Depends(require_bearer_token)])
async def chat(request_body: ChatRequest, request: Request):
    started = time.perf_counter()
    auth_context = getattr(request.state, "auth_context", {})
    intent = classify_intent(request_body.message)
    tool_analysis: ToolAnalysis = request.app.state.tool_router.analyze(
        request_body.message,
        request.app.state.project_service.list_projects(),
    )
    tool_route = tool_analysis.route
    if tool_analysis.status in {"allowed", "blocked", "unimplemented"} and intent == "conversa":
        intent = "acao"
    elif tool_route and intent == "conversa":
        intent = "consulta"
    action_taken: Optional[dict] = None
    response: str
    elapsed_ms: int

    if tool_analysis.status == "allowed" and tool_route:
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
        response = build_operational_response(tool_analysis, command_result)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
    elif tool_analysis.status in {"blocked", "unimplemented"}:
        action_taken = {
            "command": tool_route.command if tool_route else None,
            "params": tool_route.params if tool_route else {},
            "status": tool_analysis.status,
            "result": {
                "message": tool_analysis.reason,
                "stdout": None,
                "stderr": None,
                "metadata": {"action_label": tool_analysis.action_label},
            },
        }
        response = build_operational_response(tool_analysis)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
    else:
        response, elapsed_ms = await request.app.state.ollama_service.generate_response(
            message=request_body.message,
            history=request_body.context.history,
            temperature=request_body.options.temperature,
            think=request_body.options.think,
        )

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
        suggested_action=suggest_action(request_body.message) if not action_taken and tool_analysis.status == "non_operational" else None,
        session_id=request_body.context.session_id,
        processing_time_ms=elapsed_ms,
        model=request.app.state.settings.model_name,
        persistence_mode=request.app.state.persistence_service.get_state().mode,
    )
    return ApiResponse(data=data)
