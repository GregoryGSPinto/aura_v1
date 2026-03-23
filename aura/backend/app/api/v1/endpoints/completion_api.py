"""
Code Completion API — AI autocomplete for the editor.

POST /api/v1/code/complete — returns completion suggestion from Ollama.
Uses FIM (Fill In the Middle) if supported, else simple prompt.
"""

import logging
import re
import time

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")
router = APIRouter(prefix="/code", dependencies=[Depends(require_bearer_token)])

_last_request_time = 0.0


class CompletionBody(BaseModel):
    file_path: str = ""
    language: str = "python"
    prefix: str
    suffix: str = ""
    max_tokens: int = 100


@router.post("/complete")
async def code_complete(body: CompletionBody, request: Request):
    global _last_request_time

    # Rate limit: 1 req/sec
    now = time.time()
    if now - _last_request_time < 1.0:
        return {"success": True, "data": {"completion": ""}}
    _last_request_time = now

    ollama_service = request.app.state.ollama_service

    # Build FIM prompt
    prefix_lines = body.prefix.split("\n")
    # Keep last ~30 lines for context
    context_prefix = "\n".join(prefix_lines[-30:])
    suffix_lines = body.suffix.split("\n")
    context_suffix = "\n".join(suffix_lines[:10])

    # Try FIM format first
    prompt = f"<|fim_prefix|>{context_prefix}<|fim_suffix|>{context_suffix}<|fim_middle|>"

    try:
        result = await ollama_service.generate(
            prompt=prompt,
            options={
                "num_predict": body.max_tokens,
                "temperature": 0.2,
                "stop": ["\n\n", "<|fim_", "<|end", "```"],
            },
        )

        completion = result.get("response", "")

        # Clean up: remove markdown fences, explanations
        completion = re.sub(r"^```\w*\n?", "", completion)
        completion = re.sub(r"\n?```$", "", completion)
        completion = completion.rstrip()

        # If completion is too long or looks like an explanation, truncate
        lines = completion.split("\n")
        if len(lines) > 5:
            completion = "\n".join(lines[:5])

        return {"success": True, "data": {"completion": completion}}

    except Exception as exc:
        logger.debug("[Completion] Error: %s", exc)
        return {"success": True, "data": {"completion": ""}}
