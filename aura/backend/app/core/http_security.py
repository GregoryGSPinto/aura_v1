from __future__ import annotations

import re
import time
import uuid
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request

from app.core.exceptions import AuraError


SENSITIVE_KEY_PATTERN = re.compile(r"(token|secret|password|key|authorization)", re.IGNORECASE)
BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def ensure_request_id(request: Request) -> str:
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    return request_id


def sanitize_string(value: str | None, max_length: int = 1200) -> str | None:
    if value is None:
        return None
    sanitized = BEARER_PATTERN.sub("Bearer [redacted]", value)
    sanitized = re.sub(r"(?i)(token|secret|password|key)\s*[:=]\s*([^\s,;]+)", r"\1=[redacted]", sanitized)
    return sanitized[:max_length]


def sanitize_mapping(payload: Dict | None) -> Dict:
    if not payload:
        return {}
    result: Dict = {}
    for key, value in payload.items():
        if SENSITIVE_KEY_PATTERN.search(str(key)):
            result[key] = "[redacted]"
            continue
        if isinstance(value, str):
            result[key] = sanitize_string(value, max_length=240)
        else:
            result[key] = value
    return result


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._events: Dict[str, Deque[float]] = defaultdict(deque)

    def enforce(self, key: str, limit: int, window_seconds: int) -> None:
        if limit <= 0:
            return
        now = time.time()
        bucket = self._events[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise AuraError(
                "rate_limit_exceeded",
                "Limite temporario de requisicoes excedido para esta superficie.",
                details={"limit": limit, "window_seconds": window_seconds},
                status_code=429,
            )
        bucket.append(now)


rate_limiter = SlidingWindowRateLimiter()


def enforce_rate_limit(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    client_ip = get_client_ip(request)
    identity = getattr(request.state, "auth_context", {}).get("user_id") or client_ip
    rate_limiter.enforce(f"{bucket}:{identity}", limit=limit, window_seconds=window_seconds)
