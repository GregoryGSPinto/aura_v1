from typing import Optional

from fastapi import Header, Request

from app.core.exceptions import AuthError


BLOCKED_PATTERNS = [
    "rm",
    "rm -rf",
    "sudo rm",
    "format",
    "mkfs",
    "dd ",
    "shutdown",
    "reboot",
    "killall",
]


def ensure_not_blocked(raw_command: str) -> None:
    normalized = raw_command.lower().strip()
    for pattern in BLOCKED_PATTERNS:
        if pattern in normalized:
            raise AuthError("Operação recusada por conter padrão explicitamente proibido")


def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()


async def require_bearer_token(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> None:
    settings = request.app.state.settings
    if not settings.require_auth:
        request.state.auth_context = {
            "authenticated": True,
            "auth_mode": settings.auth_mode,
            "provider": "disabled",
            "user_id": "local-dev",
        }
        return

    token = extract_bearer_token(authorization)
    if not token:
        raise AuthError()

    auth_context = request.app.state.auth_service.validate_token(token)
    if not auth_context.get("authenticated"):
        raise AuthError()
    request.state.auth_context = auth_context
