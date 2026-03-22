"""
Chat Streaming — Server-Sent Events (SSE).

Endpoint: POST /api/v1/chat/stream
"""

import json
import time
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.core.security import require_bearer_token
from app.models.chat_models import ChatRequest

logger = logging.getLogger("aura")
router = APIRouter()


@router.post("/chat/stream", dependencies=[Depends(require_bearer_token)])
async def chat_stream(request: Request, request_body: ChatRequest):
    """Streaming chat via SSE."""

    async def event_generator() -> AsyncGenerator[str, None]:
        start_time = time.time()
        full_response = ""

        try:
            behavior_service = request.app.state.behavior_service
            context_service = request.app.state.context_service
            runtime_context = context_service.build_chat_runtime_context(
                session_id=request_body.context.session_id,
                message=request_body.message,
                project_id=request_body.context.project_id,
            )

            intent = runtime_context.get("behavior_mode", "companion")
            yield f"data: {json.dumps({'type': 'intent', 'content': intent})}\n\n"

            system_prompt = behavior_service.build_chat_prompt(
                runtime_context.get("context_summary", ""),
                runtime_context.get("memory_prompt_points", []),
                runtime_context.get("behavior_mode", "companion"),
            )

            ollama_service = request.app.state.ollama_service
            history = []
            if request_body.context and request_body.context.history:
                for h in request_body.context.history:
                    history.append({"role": h.role, "content": h.content})

            async for token in ollama_service.generate_stream(
                message=request_body.message,
                history=history,
                system_prompt=system_prompt,
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Check for tool calls
            tool_parser = getattr(request.app.state, "tool_call_parser", None)
            if tool_parser:
                tool_call = tool_parser.parse(full_response)
                if tool_call:
                    yield f"data: {json.dumps({'type': 'tool_call', 'content': tool_call})}\n\n"
                    tool_executor = getattr(request.app.state, "tool_executor_service", None)
                    if tool_executor:
                        result = await tool_executor.execute(tool_call)
                        yield f"data: {json.dumps({'type': 'tool_result', 'content': result})}\n\n"

            elapsed_ms = int((time.time() - start_time) * 1000)
            yield f"data: {json.dumps({'type': 'done', 'content': {'full_response': full_response, 'elapsed_ms': elapsed_ms, 'provider': 'ollama'}})}\n\n"

        except Exception as exc:
            logger.error("[ChatStream] Error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'content': {'message': str(exc)}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
