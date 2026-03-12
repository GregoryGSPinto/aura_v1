from fastapi.testclient import TestClient

from app import main as main_module


AUTH_HEADERS = {"Authorization": "Bearer change-me"}


def build_client(monkeypatch):
    monkeypatch.setattr(main_module.container.job_service, "start", lambda: None)
    monkeypatch.setattr(main_module.container.job_service, "stop", lambda: None)
    app = main_module.app

    class DummyOllamaService:
        async def check_health(self):
            return "online"

    class DummySupabaseService:
        def check_health(self):
            return "offline"

    app.state.ollama_service = DummyOllamaService()
    app.state.supabase_service = DummySupabaseService()
    return TestClient(app)


def test_companion_overview_exposes_founder_cockpit(monkeypatch):
    client = build_client(monkeypatch)

    response = client.get("/api/v1/companion/overview", headers=AUTH_HEADERS)

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["founder_mode"] is True
    assert "priorities" in payload
    assert "quick_actions" in payload


def test_companion_trust_exposes_policy_state(monkeypatch):
    client = build_client(monkeypatch)

    response = client.get("/api/v1/companion/trust", headers=AUTH_HEADERS)

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["policy_state"]["default_mode"] == "deny-by-default"
    assert "signals" in payload
