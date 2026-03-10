from typing import Dict, List, Optional

from app.agents.models import AgentPlan
from app.agents.planner import AgentPlanner
from app.models.project_models import Project


class PlannerAdapter:
    def __init__(self, planner: AgentPlanner):
        self.planner = planner

    def create_plan(self, goal: str, projects: List[Project], title: Optional[str] = None) -> AgentPlan:
        return self.planner.create_plan(goal, projects, title)

    def summarize(self, plan: AgentPlan) -> Dict[str, object]:
        return {
            "title": plan.title,
            "status": plan.status,
            "steps": [step.model_dump() for step in plan.steps],
            "notes": plan.notes,
        }
