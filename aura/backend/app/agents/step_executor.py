from typing import Any, Dict

from app.models.command_models import CommandExecutionResult
from app.models.job_models import JobStepRequest
from app.services.command_service import CommandService


class AgentStepExecutor:
    def __init__(self, command_service: CommandService):
        self.command_service = command_service

    def execute(self, step: JobStepRequest) -> CommandExecutionResult:
        if not step.command:
            raise ValueError("Step sem comando executável.")
        return self.command_service.execute(
            step.command,
            step.params,
            actor={"user_id": "aura-agent", "provider": "agent-step-executor"},
        )

