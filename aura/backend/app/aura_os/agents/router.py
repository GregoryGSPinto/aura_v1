from typing import Dict, List

from app.aura_os.agents.automation_agent import AutomationAgent
from app.aura_os.agents.developer_agent import DeveloperAgent
from app.aura_os.agents.research_agent import ResearchAgent
from app.aura_os.agents.system_agent import SystemAgent


class AgentRouter:
    def __init__(self):
        self.agents = [SystemAgent(), DeveloperAgent(), ResearchAgent(), AutomationAgent()]

    def list_agents(self) -> List[Dict[str, object]]:
        return [
            {
                "name": agent.name,
                "description": agent.description,
                "specialties": agent.specialties,
            }
            for agent in self.agents
        ]

    def select(self, goal: str) -> Dict[str, object]:
        lowered = goal.lower()
        if any(term in lowered for term in ["git", "build", "lint", "test", "repo", "code", "debug"]):
            agent = DeveloperAgent()
        elif any(term in lowered for term in ["internet", "pesquise", "search", "web", "site"]):
            agent = ResearchAgent()
        elif any(term in lowered for term in ["automat", "schedule", "workflow", "gatilho"]):
            agent = AutomationAgent()
        else:
            agent = SystemAgent()
        return {
            "name": agent.name,
            "description": agent.description,
            "specialties": agent.specialties,
        }
