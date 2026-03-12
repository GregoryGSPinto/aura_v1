from fastapi import Request

from app.core.http_security import enforce_rate_limit


def limit_chat_requests(request: Request) -> None:
    settings = request.app.state.settings
    enforce_rate_limit(request, "chat", settings.rate_limit_chat_requests, settings.rate_limit_window_seconds)


def limit_command_requests(request: Request) -> None:
    settings = request.app.state.settings
    enforce_rate_limit(request, "command", settings.rate_limit_command_requests, settings.rate_limit_window_seconds)


def limit_auth_requests(request: Request) -> None:
    settings = request.app.state.settings
    enforce_rate_limit(request, "auth", settings.rate_limit_auth_requests, settings.rate_limit_window_seconds)
