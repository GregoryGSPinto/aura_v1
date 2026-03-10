from app.aura_os.agents.router import AgentRouter
from app.aura_os.automation.scheduler import WorkflowScheduler
from app.aura_os.config.settings import AuraOSSettings
from app.aura_os.core.agent import AuraOperatingSystem
from app.aura_os.core.planner import PlannerAdapter
from app.aura_os.core.reasoner import Reasoner
from app.aura_os.core.router import IntentRouter
from app.aura_os.core.tool_executor import ToolExecutor
from app.aura_os.integrations.anthropic import AnthropicProvider
from app.aura_os.integrations.model_router import ModelRouter
from app.aura_os.integrations.openai import OpenAIProvider
from app.aura_os.memory.manager import MemoryManager
from app.aura_os.tools.registry import ToolRegistry
from app.aura_os.voice.pipeline import VoicePipeline
from app.agents.job_manager import AgentJobManager
from app.agents.models import AgentExecutionResult
from app.agents.planner import AgentPlanner
from app.core.config import Settings
from app.models.project_models import Project


class DummyMemoryService:
    def __init__(self):
        self.settings = {}

    def get_settings(self):
        return self.settings

    def update_settings(self, updates):
        self.settings.update(updates)
        return self.settings


class DummyCommandService:
    def execute(self, command, params, actor):
        return type("CommandResult", (), {"command": command, "params": params, "actor": actor})()


class DummyJobManager:
    def create_job_from_goal(self, request):
        return AgentExecutionResult(job_id="job_test", plan_status="planned", started=request.auto_start, notes=[])


def test_aura_os_executes_goal_with_plan():
    settings = Settings()
    registry = ToolRegistry()
    registry.register_defaults()
    aura_os = AuraOperatingSystem(
        settings=AuraOSSettings(settings),
        planner=PlannerAdapter(AgentPlanner()),
        reasoner=Reasoner(),
        intent_router=IntentRouter(type("Router", (), {"route": lambda self, goal, projects: None})()),
        tool_executor=ToolExecutor(DummyCommandService()),
        memory_manager=MemoryManager(DummyMemoryService()),
        tool_registry=registry,
        voice_pipeline=VoicePipeline(),
        job_manager=DummyJobManager(),
        agent_router=AgentRouter(),
        model_router=ModelRouter(settings.model_name),
        scheduler=WorkflowScheduler(),
        ollama_provider=type("Provider", (), {"status": lambda self: None})(),
        openai_provider=OpenAIProvider(),
        anthropic_provider=AnthropicProvider(),
        list_projects_callable=lambda: [Project(name="aura_v1", path="/tmp/aura_v1", description=None, commands={})],
    )

    result = aura_os.execute(type("Request", (), {"goal": "Abra o projeto aura_v1 e rode lint", "auto_start": False, "actor_id": "tester"})())
    assert result.plan_status == "planned"
    assert result.planned_steps >= 2
