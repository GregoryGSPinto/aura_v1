from typing import Dict, List, Optional

from app.models.project_models import Project
from app.tools.tool_router import ToolRoute, ToolRouter


class IntentRouter:
    def __init__(self, tool_router: ToolRouter):
        self.tool_router = tool_router

    def route(self, goal: str, projects: List[Project]) -> Optional[Dict[str, object]]:
        route: Optional[ToolRoute] = self.tool_router.route(goal, projects)
        if not route:
            return None
        return {
            "command": route.command,
            "params": route.params,
            "reason": route.reason,
        }
