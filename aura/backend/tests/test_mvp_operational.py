from fastapi.testclient import TestClient

from app import main as main_module
from app.core.exceptions import ModelUnavailableError
from app.core.http_security import rate_limiter


AUTH_HEADERS = {"Authorization": f"Bearer {main_module.container.settings.auth_token}"}


def build_client(monkeypatch):
    monkeypatch.setattr(main_module.get_container(), "start_runtime", lambda: None)
    monkeypatch.setattr(main_module.get_container(), "stop_runtime", lambda: None)
    rate_limiter._events.clear()
    return TestClient(main_module.app)


def test_health_status_is_available(monkeypatch):
    client = build_client(monkeypatch)

    response = client.get("/api/v1/healthz")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["status"] == "ok"


def test_auth_status_reports_authenticated_for_local_token(monkeypatch):
    client = build_client(monkeypatch)

    response = client.get("/api/v1/auth/status", headers=AUTH_HEADERS)

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["authenticated"] is True
    assert payload["provider"] == "local-token"


def test_chat_surfaces_model_unavailable_error(monkeypatch):
    client = build_client(monkeypatch)

    original_ollama_service = main_module.app.state.ollama_service

    class FailingOllamaService:
        async def generate_response(self, *args, **kwargs):
            raise ModelUnavailableError("O modelo local 'qwen3.5:9b' não está disponível no Ollama.")

        async def check_health(self):
            return "online"

    main_module.app.state.ollama_service = FailingOllamaService()

    try:
        response = client.post(
            "/api/v1/chat",
            headers=AUTH_HEADERS,
            json={"message": "Olá", "context": {"session_id": "model-missing", "history": []}},
        )
    finally:
        main_module.app.state.ollama_service = original_ollama_service

    assert response.status_code == 503
    payload = response.json()["error"]
    assert payload["code"] == "model_unavailable"
