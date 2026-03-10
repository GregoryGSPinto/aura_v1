from typing import Dict

from app.aura_os.automation.actions import ActionRegistry
from app.aura_os.automation.workflows import WorkflowLibrary


class WorkflowScheduler:
    def __init__(self):
        self.actions = ActionRegistry()
        self.workflows = WorkflowLibrary()

    def overview(self) -> Dict[str, object]:
        return {
            "scheduler_ready": False,
            "actions": self.actions.list_actions(),
            "workflows": self.workflows.list_workflows(),
            "notes": ["Scheduler preparado para evolução futura sem daemon adicional nesta fase."],
        }
