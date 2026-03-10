from typing import Dict

from app.aura_os.core.cognition import CognitionEngine
from app.aura_os.core.planner import PlannerAdapter
from app.aura_os.core.reasoner import Reasoner
from app.aura_os.core.router import IntentRouter


class AgentLoop:
    def __init__(self, cognition: CognitionEngine, reasoner: Reasoner, planner: PlannerAdapter, router: IntentRouter):
        self.cognition = cognition
        self.reasoner = reasoner
        self.planner = planner
        self.router = router

    def run(self, goal: str, projects) -> Dict[str, object]:
        perception = self.cognition.perceive(goal)
        reasoning = self.reasoner.analyze(goal)
        route = self.router.route(goal, projects)
        plan = self.planner.create_plan(goal, projects)
        learning = self.cognition.learn(goal, plan.status)
        return {
            "perception": perception,
            "reasoning": reasoning,
            "route": route,
            "plan": self.planner.summarize(plan),
            "learning": learning,
        }
