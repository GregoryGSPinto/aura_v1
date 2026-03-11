from fastapi.testclient import TestClient

from app import main as main_module
from app.core.exceptions import CommandBlockedError
from app.models.command_models import CommandExecutionResult
from app.models.persistence_models import PersistenceState
from app.models.project_models import Project
from app.tools.tool_router import ToolRouter


AUTH_HEADERS = {"Authorization": "Bearer change-me"}


class DummyProjectService:
    def list_projects(self):
        return [Project(name="aura_v1", path="/tmp/aura_v1", description="Aura", commands={})]


class DummyPersistenceService:
    def upsert_chat_session(self, session):
        return session

    def append_chat_messages(self, messages):
        return messages

    def get_state(self):
        return PersistenceState(
            mode="local",
            supabase_enabled=False,
            supabase_configured=False,
            auth_mode="local",
            warnings=[],
        )


class DummyOllamaService:
    async def generate_response(self, message, history, temperature=0.2, think=False):
        return "Resposta conversacional.", 17


class DummyCommandService:
    def __init__(self):
        self.calls = []

    def execute(self, command, params=None, actor=None):
        self.calls.append({"command": command, "params": params or {}, "actor": actor})
        if command == "blocked_command":
            raise CommandBlockedError()
        if command == "open_terminal":
            return CommandExecutionResult(
                command="open_terminal",
                status="success",
                message="Terminal aberto com sucesso.",
                stdout="",
                stderr="",
                metadata={"platform": "macOS"},
                execution_time_ms=5,
                log_id="log-terminal",
            )
        return CommandExecutionResult(
            command=command,
            status="success",
            message="Comando executado.",
            stdout="",
            stderr="",
            metadata={},
            execution_time_ms=5,
            log_id="log-generic",
        )


def build_client(monkeypatch):
    monkeypatch.setattr(main_module.container.job_service, "start", lambda: None)
    monkeypatch.setattr(main_module.container.job_service, "stop", lambda: None)
    app = main_module.app
    app.state.project_service = DummyProjectService()
    app.state.persistence_service = DummyPersistenceService()
    app.state.ollama_service = DummyOllamaService()
    app.state.tool_router = ToolRouter()
    app.state.command_service = DummyCommandService()
    return TestClient(app), app.state.command_service


def test_chat_keeps_simple_conversation_on_llm(monkeypatch):
    client, command_service = build_client(monkeypatch)

    response = client.post(
        "/api/v1/chat",
        headers=AUTH_HEADERS,
        json={"message": "Oi, tudo bem?", "context": {"session_id": "chat-simple", "history": []}},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["intent"] == "conversa"
    assert payload["response"] == "Resposta conversacional."
    assert payload["action_taken"] is None
    assert command_service.calls == []


def test_chat_executes_allowed_open_terminal_action(monkeypatch):
    client, command_service = build_client(monkeypatch)

    response = client.post(
        "/api/v1/chat",
        headers=AUTH_HEADERS,
        json={
            "message": "consegue abrir o terminal do meu computador?",
            "context": {"session_id": "chat-terminal", "history": []},
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["intent"] == "acao"
    assert payload["action_taken"]["command"] == "open_terminal"
    assert "ação operacional permitida" in payload["response"]
    assert "abrir o Terminal" in payload["response"]
    assert command_service.calls[0]["command"] == "open_terminal"


def test_chat_returns_policy_block_for_disallowed_operational_request(monkeypatch):
    client, command_service = build_client(monkeypatch)

    response = client.post(
        "/api/v1/chat",
        headers=AUTH_HEADERS,
        json={
            "message": "consegue apagar meus arquivos do sistema?",
            "context": {"session_id": "chat-blocked", "history": []},
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["intent"] == "acao"
    assert payload["action_taken"]["status"] == "blocked"
    assert "bloqueado pela política de segurança" in payload["response"]
    assert command_service.calls == []


def test_chat_returns_not_implemented_for_unknown_operational_request(monkeypatch):
    client, command_service = build_client(monkeypatch)

    response = client.post(
        "/api/v1/chat",
        headers=AUTH_HEADERS,
        json={
            "message": "consegue abrir a calculadora?",
            "context": {"session_id": "chat-unimplemented", "history": []},
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["intent"] == "acao"
    assert payload["action_taken"]["status"] == "unimplemented"
    assert "ainda não foi implementada" in payload["response"]
    assert command_service.calls == []


def test_command_endpoint_accepts_open_terminal(monkeypatch):
    client, command_service = build_client(monkeypatch)

    response = client.post(
        "/api/v1/command",
        headers=AUTH_HEADERS,
        json={"command": "open_terminal", "params": {}},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["command"] == "open_terminal"
    assert payload["status"] == "success"
    assert command_service.calls[0]["command"] == "open_terminal"
