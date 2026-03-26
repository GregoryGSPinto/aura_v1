import hashlib
import time
from typing import Optional

from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token, sanitize_mapping, sanitize_string
from app.core.security_policies import limit_chat_requests
from app.models.chat_models import ChatRequest, ChatResponseData, SuggestedAction
from app.models.command_models import CommandExecutionResult
from app.models.common_models import ApiResponse
from app.models.persistence_models import ChatMessageRecord, ChatSessionRecord
from app.services.events import AuraEvent
from app.services.websocket_manager import ws_manager
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
        return sanitize_string(command_result.stdout, max_length=1200) or ""

    metadata = command_result.metadata or {}
    if metadata:
        visible_items = [f"{key}: {value}" for key, value in sanitize_mapping(metadata).items() if key not in {"projects"}]
        if visible_items:
            return "\n".join(visible_items[:8])

    return ""


@router.post(
    "/chat",
    response_model=ApiResponse[ChatResponseData],
    dependencies=[Depends(require_bearer_token), Depends(limit_chat_requests)],
)
async def chat(request_body: ChatRequest, request: Request):
    started = time.perf_counter()
    auth_context = getattr(request.state, "auth_context", {})
    runtime_context = request.app.state.context_service.build_chat_runtime_context(
        session_id=request_body.context.session_id,
        message=request_body.message,
        project_id=request_body.context.project_id,
    )
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
    action_preview: Optional[dict] = None
    response: str
    elapsed_ms: int
    used_provider: str = "ollama"
    route: Optional[str] = None
    actions_taken: Optional[list] = None
    plan: Optional[dict] = None
    brain_used: Optional[str] = None
    complexity: Optional[int] = None
    classification_reason: Optional[str] = None
    tool_calls: Optional[list] = None

    # Brain override from @local / @cloud prefix
    brain_override_header = request.headers.get("x-aura-brain-override")
    raw_message = request_body.message
    if raw_message.startswith("@local "):
        brain_override_header = "local"
        request_body.message = raw_message[7:]
    elif raw_message.startswith("@cloud "):
        brain_override_header = "cloud"
        request_body.message = raw_message[7:]

    # Emit chat.thinking via WebSocket
    session_id = request_body.context.session_id
    await ws_manager.send_to_session(session_id, AuraEvent.chat_thinking(session_id))

    if tool_analysis.status == "allowed" and tool_route:
        preview = request.app.state.action_governance_service.preview(tool_route.command, tool_route.params)
        action_preview = preview.model_dump()
        if tool_route.command == "auradev_execute":
            # AuraDev: route dev tasks to the dual-brain engine
            dev_tool = getattr(request.app.state, "dev_tool", None)
            if dev_tool:
                intent_type = tool_route.params.get("intent_type", "task")
                dev_response = await dev_tool.execute_from_intent(intent_type, tool_route.params)
                action_taken = {
                    "command": "auradev_execute",
                    "params": sanitize_mapping(tool_route.params),
                    "status": "success",
                    "result": {
                        "message": dev_response,
                        "stdout": None,
                        "stderr": None,
                        "metadata": {"intent_type": intent_type},
                    },
                }
                response = dev_response
            else:
                response = "AuraDev não está disponível."
                action_taken = {
                    "command": "auradev_execute",
                    "params": sanitize_mapping(tool_route.params),
                    "status": "error",
                    "result": {"message": response, "stdout": None, "stderr": None, "metadata": {}},
                }
            elapsed_ms = int((time.perf_counter() - started) * 1000)
        elif tool_route.command == "claude_execute":
            # Claude Code: async execution via ClaudeTool
            claude_prompt = tool_route.params.get("prompt", request_body.message)
            claude_result = await request.app.state.claude_tool.execute(
                prompt=claude_prompt,
                working_dir=tool_route.params.get("working_dir"),
            )
            exit_code = claude_result.get("exit_code", -1)
            output = claude_result.get("output", "")
            error = claude_result.get("error", "")
            action_taken = {
                "command": "claude_execute",
                "params": sanitize_mapping(tool_route.params),
                "status": "success" if exit_code == 0 else "error",
                "result": {
                    "message": output or error or "Claude Code executou sem saída.",
                    "stdout": sanitize_string(output),
                    "stderr": sanitize_string(error),
                    "metadata": {"exit_code": exit_code},
                },
            }
            response = output if exit_code == 0 else f"Erro do Claude Code:\n{error or output}"
            if not response:
                response = "Claude Code executou o comando sem saída."
            elapsed_ms = int((time.perf_counter() - started) * 1000)
        elif preview.requires_confirmation:
            action_taken = {
                "command": tool_route.command,
                "params": sanitize_mapping(tool_route.params),
                "status": "awaiting_confirmation",
                "result": {
                    "message": "Aguardando confirmação explícita do usuário.",
                    "stdout": None,
                    "stderr": None,
                    "metadata": {"risk_level": preview.risk_level, "category": preview.category},
                },
            }
            response = request.app.state.behavior_service.action_confirmation_copy(action_preview)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
        else:
            command_result: CommandExecutionResult = request.app.state.command_service.execute(
                tool_route.command,
                tool_route.params,
                actor={
                    "user_id": auth_context.get("user_id") or "chat-router",
                    "provider": "chat",
                    "request_id": getattr(request.state, "request_id", None),
                },
            )
            action_taken = {
                "command": command_result.command,
                "params": sanitize_mapping(tool_route.params),
                "status": command_result.status,
                "result": {
                    "message": command_result.message,
                    "stdout": sanitize_string(command_result.stdout),
                    "stderr": sanitize_string(command_result.stderr),
                    "metadata": sanitize_mapping(command_result.metadata),
                },
            }
            response = build_operational_response(tool_analysis, command_result)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
    elif tool_analysis.status in {"blocked", "unimplemented"}:
        if tool_route:
            action_preview = request.app.state.action_governance_service.preview(tool_route.command, tool_route.params).model_dump()
        action_taken = {
            "command": tool_route.command if tool_route else None,
            "params": sanitize_mapping(tool_route.params if tool_route else {}),
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
        # === Brain Router classification ===
        br = getattr(request.app.state, "brain_router", None)
        cc = getattr(request.app.state, "claude_client", None)

        if br:
            classification = br.classify(request_body.message)
            target = classification["target"]
            complexity = classification["complexity"].value
            classification_reason = classification["reason"]

            # Apply brain override
            if brain_override_header == "cloud" and cc and cc.available:
                from app.services.brain_router import BrainTarget
                target = BrainTarget.CLOUD
                classification_reason = "Override manual: @cloud"
            elif brain_override_header == "local":
                from app.services.brain_router import BrainTarget
                target = BrainTarget.LOCAL
                classification_reason = "Override manual: @local"

            brain_used = target.value
            br.track_classification(classification["complexity"])

            # Emit brain routing event via WebSocket
            await ws_manager.send_to_session(
                session_id,
                AuraEvent.chat_brain_routing(session_id, target.value, complexity, classification_reason),
            )
        else:
            from app.services.brain_router import BrainTarget
            target = BrainTarget.LOCAL
            brain_used = "local"
            complexity = 2
            classification_reason = "Brain router nao disponivel"

        # Sprint 3: Inject SQLite memory context
        sqlite_mem = getattr(request.app.state, "sqlite_memory", None)
        memory_context_block = ""
        if sqlite_mem:
            try:
                memory_context_block = sqlite_mem.build_context_prompt(
                    session_id=session_id,
                    project_slug=request_body.context.project_id,
                )
            except Exception:
                pass

        # Try ChatRouterService first (handles agent routing + tool calling)
        chat_router = getattr(request.app.state, "chat_router_service", None)
        router_result = None
        if chat_router:
            try:
                router_result = await chat_router.process(
                    message=request_body.message,
                    context={
                        "context_summary": runtime_context["context_summary"],
                        "memory_prompt_points": runtime_context["memory_prompt_points"],
                        "behavior_mode": runtime_context["behavior_mode"],
                        "history": request_body.context.history,
                        "memory_context_block": memory_context_block,
                    },
                )
            except Exception:
                router_result = None

        if router_result:
            response = router_result.get("response", "")
            elapsed_ms = router_result.get("elapsed_ms", int((time.perf_counter() - started) * 1000))
            used_provider = router_result.get("provider", "ollama")
            route = router_result.get("route")
            actions_taken = router_result.get("actions_taken")
            plan = router_result.get("plan")
            tool_calls = router_result.get("tool_calls")
            if br:
                br.track_usage(target)
        else:
            # Brain-routed fallback
            route = None
            actions_taken = None
            plan = None

            chat_system_prompt = request.app.state.behavior_service.build_chat_prompt(
                runtime_context["context_summary"],
                runtime_context["memory_prompt_points"],
                runtime_context["behavior_mode"],
            )

            if target == BrainTarget.CLOUD and cc and cc.available:
                # Route to Claude API
                messages = [
                    {"role": item.role, "content": item.content}
                    for item in request_body.context.history
                ]
                messages.append({"role": "user", "content": request_body.message})
                try:
                    result = await cc.chat(
                        messages=messages,
                        system_prompt=chat_system_prompt,
                        temperature=request_body.options.temperature,
                    )
                    response = result["content"]
                    elapsed_ms = int((time.perf_counter() - started) * 1000)
                    used_provider = "anthropic"
                    if br:
                        br.track_usage(target)
                except Exception:
                    # Fallback to local on cloud failure
                    response, elapsed_ms = await request.app.state.ollama_service.generate_response(
                        message=request_body.message,
                        history=request_body.context.history,
                        temperature=request_body.options.temperature,
                        think=request_body.options.think,
                        system_prompt=chat_system_prompt,
                    )
                    brain_used = "local"
                    classification_reason += " [FALLBACK: erro na Claude API]"
                    if br:
                        br.track_usage(BrainTarget.LOCAL)
            else:
                # Route to Qwen (local)
                response, elapsed_ms = await request.app.state.ollama_service.generate_response(
                    message=request_body.message,
                    history=request_body.context.history,
                    temperature=request_body.options.temperature,
                    think=request_body.options.think,
                    system_prompt=chat_system_prompt,
                )
                if br:
                    br.track_usage(target)

    request.app.state.persistence_service.upsert_chat_session(
        ChatSessionRecord(
            session_id=request_body.context.session_id,
            user_id=auth_context.get("user_id"),
            project_id=request_body.context.project_id,
            metadata={"source": "api.chat"},
        )
    )
    request.app.state.context_service.remember_exchange(
        session_id=request_body.context.session_id,
        user_message=request_body.message,
        assistant_message=response,
        intent=intent,
        action_taken=action_taken,
    )
    # Sprint 3: Auto-extract knowledge from user message
    ke = getattr(request.app.state, "knowledge_extractor", None)
    if ke:
        try:
            await ke.extract_and_save(request_body.message, response, session_id)
        except Exception:
            pass
    trust_snapshot = request.app.state.context_service.trust_snapshot(
        status={
            "auth_mode": request.app.state.settings.auth_mode,
            "services": {"llm": await request.app.state.ollama_service.check_health()},
        },
        voice_status=request.app.state.voice_pipeline.status().model_dump(),
        audit_logs=request.app.state.persistence_service.get_recent_audit_logs(limit=6),
    )
    system_prompt_text = request.app.state.behavior_service.build_chat_prompt(
        runtime_context["context_summary"],
        runtime_context["memory_prompt_points"],
        runtime_context["behavior_mode"],
    )
    system_prompt_hash = hashlib.sha256(system_prompt_text[:200].encode()).hexdigest()
    assistant_metadata = {
        "response_time_ms": elapsed_ms,
        "behavior_mode": runtime_context.get("behavior_mode"),
        "provider": used_provider,
        "tokens_used": None,
        "user_satisfaction": None,
        "system_prompt_hash": system_prompt_hash,
    }
    if action_taken:
        assistant_metadata["action_taken"] = action_taken
        if action_preview:
            assistant_metadata["risk_score"] = action_preview.get("risk_score")
    if runtime_context.get("memory_signals"):
        assistant_metadata["memory_signals"] = runtime_context["memory_signals"][:5]
    if trust_snapshot.get("signals"):
        assistant_metadata["trust_signals"] = trust_snapshot["signals"][:3]
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
                metadata=assistant_metadata,
            ),
        ]
    )
    data = ChatResponseData(
        response=response,
        intent=intent,  # type: ignore[arg-type]
        action_taken=action_taken,
        suggested_action=suggest_action(request_body.message) if not action_taken and tool_analysis.status == "non_operational" else None,
        action_preview=action_preview,
        context_summary=runtime_context["context_summary"],
        memory_signals=runtime_context["memory_signals"],
        trust_signals=trust_snapshot["signals"][:3],
        behavioral_mode=runtime_context["behavior_mode"],
        session_id=request_body.context.session_id,
        processing_time_ms=elapsed_ms,
        model=request.app.state.settings.model_name,
        provider=used_provider,
        persistence_mode=request.app.state.persistence_service.get_state().mode,
        route=route,
        actions_taken=actions_taken,
        plan=plan,
        brain_used=brain_used,
        complexity=complexity,
        classification_reason=classification_reason,
        tool_calls=tool_calls,
    )

    # Emit chat.done via WebSocket
    await ws_manager.send_to_session(
        session_id,
        AuraEvent.chat_done(session_id, {
            "brain_used": brain_used,
            "complexity": complexity,
            "classification_reason": classification_reason,
            "provider": used_provider,
            "processing_time_ms": elapsed_ms,
            "intent": intent,
        }),
    )

    return ApiResponse(data=data)
