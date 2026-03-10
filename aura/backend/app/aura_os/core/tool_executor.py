from typing import Any, Dict

from app.models.command_models import CommandExecutionResult
from app.services.command_service import CommandService


class ToolExecutor:
    def __init__(self, command_service: CommandService):
        self.command_service = command_service

    def execute(self, command: str, params: Dict[str, Any], actor_id: str) -> CommandExecutionResult:
        return self.command_service.execute(
            command,
            params,
            actor={"user_id": actor_id, "provider": "aura-os"},
        )
