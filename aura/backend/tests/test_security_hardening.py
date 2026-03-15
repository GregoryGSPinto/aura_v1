from fastapi.testclient import TestClient

from app import main as main_module
from app.core.http_security import rate_limiter
from app.tools.tool_router import ToolRouter


AUTH_HEADERS = {"Authorization": "Bearer change-me"}


def build_client(monkeypatch):
    monkeypatch.setattr(main_module.container, "start_runtime", lambda: None)
    monkeypatch.setattr(main_module.container, "stop_runtime", lambda: None)
    rate_limiter._events.clear()
    app = main_module.app

    class DummyOllamaService:
        async def check_health(self):
            return "online"

        async def health_details(self):
            return {
                "status": "online",
                "url": "http://localhost:11434",
                "model": "qwen3.5:9b",
                "model_available": True,
                "models": ["qwen3.5:9b"],
            }

    class DummySupabaseService:
        def check_health(self):
            return "offline"

    app.state.ollama_service = DummyOllamaService()
    app.state.supabase_service = DummySupabaseService()
    app.state.tool_router = ToolRouter()
    return TestClient(app)


def test_status_response_includes_security_headers(monkeypatch):
    client = build_client(monkeypatch)

    response = client.get("/api/v1/status")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-request-id"]


def test_auth_status_is_rate_limited(monkeypatch):
    client = build_client(monkeypatch)

    settings = main_module.app.state.settings
    original_limit = settings.rate_limit_auth_requests
    original_window = settings.rate_limit_window_seconds
    settings.rate_limit_auth_requests = 1
    settings.rate_limit_window_seconds = 60

    try:
        first = client.get("/api/v1/auth/status", headers=AUTH_HEADERS)
        second = client.get("/api/v1/auth/status", headers=AUTH_HEADERS)

        assert first.status_code == 200
        assert second.status_code == 429
    finally:
        settings.rate_limit_auth_requests = original_limit
        settings.rate_limit_window_seconds = original_window
