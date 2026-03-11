from app.models.persistence_models import PersistenceState
from app.services.command_service import CommandService
from app.tools.terminal_tool import TerminalResult


class DummyPersistenceService:
    def record_audit_log(self, entry):
        return entry

    def get_state(self):
        return PersistenceState(
            mode="local",
            supabase_enabled=False,
            supabase_configured=False,
            auth_mode="local",
            warnings=[],
        )


class DummyProjectTool:
    def list_projects(self):
        return []


class DummyTerminalTool:
    def __init__(self):
        self.opened = False

    def open_terminal(self):
        self.opened = True
        return TerminalResult(command=["open", "-a", "Terminal"], stdout="", stderr="", returncode=0)


class DummyVSCodeTool:
    def open_app(self):
        return {"message": "VS Code aberto."}


class DummySystemTool:
    def summary(self, **kwargs):
        return kwargs

    def cpu(self):
        return {"usage_percent": 10}

    def memory(self):
        return {"usage_percent": 20}

    def disk(self):
        return {"usage_percent": 30}


class DummyLogger:
    def info(self, *args, **kwargs):
        return None


def test_command_service_executes_open_terminal_from_whitelist():
    terminal_tool = DummyTerminalTool()
    service = CommandService(
        persistence_service=DummyPersistenceService(),
        project_tool=DummyProjectTool(),
        terminal_tool=terminal_tool,
        vscode_tool=DummyVSCodeTool(),
        system_tool=DummySystemTool(),
        logger=DummyLogger(),
    )

    result = service.execute("open_terminal", actor={"user_id": "tester", "provider": "pytest"})

    assert service.is_allowed("open_terminal") is True
    assert terminal_tool.opened is True
    assert result.command == "open_terminal"
    assert result.status == "success"
    assert result.message == "Terminal aberto com sucesso."
