from typing import Any, Dict, List

from app.aura_os.config.models import AuraOSExecutionRequest, AuraOSExecutionResponse, AuraOSOverview
from app.aura_os.config.settings import AuraOSSettings
from app.aura_os.core.planner import PlannerAdapter
from app.aura_os.core.reasoner import Reasoner
from app.aura_os.core.router import IntentRouter
from app.aura_os.core.tool_executor import ToolExecutor
from app.aura_os.agents.router import AgentRouter
from app.aura_os.automation.scheduler import WorkflowScheduler
from app.aura_os.integrations.anthropic import AnthropicProvider
from app.aura_os.integrations.model_router import ModelRouter
from app.aura_os.integrations.ollama import OllamaProvider
from app.aura_os.integrations.openai import OpenAIProvider
from app.aura_os.memory.manager import MemoryManager
from app.aura_os.tools.registry import ToolRegistry
from app.aura_os.voice.pipeline import VoicePipeline
from app.agents.job_manager import AgentJobManager
from app.models.project_models import Project


class AuraOperatingSystem:
    def __init__(
        self,
        settings: AuraOSSettings,
        planner: PlannerAdapter,
        reasoner: Reasoner,
        intent_router: IntentRouter,
        tool_executor: ToolExecutor,
        memory_manager: MemoryManager,
        tool_registry: ToolRegistry,
        voice_pipeline: VoicePipeline,
        job_manager: AgentJobManager,
        agent_router: AgentRouter,
        model_router: ModelRouter,
        scheduler: WorkflowScheduler,
        ollama_provider: OllamaProvider,
        openai_provider: OpenAIProvider,
        anthropic_provider: AnthropicProvider,
        list_projects_callable,
    ):
        self.settings = settings
        self.planner = planner
        self.reasoner = reasoner
        self.intent_router = intent_router
        self.tool_executor = tool_executor
        self.memory_manager = memory_manager
        self.tool_registry = tool_registry
        self.voice_pipeline = voice_pipeline
        self.job_manager = job_manager
        self.agent_router = agent_router
        self.model_router = model_router
        self.scheduler = scheduler
        self.ollama_provider = ollama_provider
        self.openai_provider = openai_provider
        self.anthropic_provider = anthropic_provider
        self.list_projects_callable = list_projects_callable

    async def overview(self) -> AuraOSOverview:
        providers = [
            await self.ollama_provider.status(),
            self.openai_provider.status(),
            self.anthropic_provider.status(),
        ]
        return AuraOSOverview(
            name="Aura Personal AI Operating System",
            version=self.settings.settings.version,
            tools=self.tool_registry.list_tools(),
            providers=providers,
            voice=self.voice_pipeline.status(),
            memory=self.memory_manager.overview(),
            agents=self.agent_router.list_agents(),
            model_router=self.model_router.overview(),
            automation=self.scheduler.overview(),
            policies=self.settings.security_policy(),
        )

    def execute(self, request: AuraOSExecutionRequest) -> AuraOSExecutionResponse:
        projects: List[Project] = self.list_projects_callable()
        perception = {"goal": request.goal}
        reasoning = self.reasoner.analyze(request.goal)
        selected_agent = self.agent_router.select(request.goal)
        route = self.intent_router.route(request.goal, projects)
        plan = self.planner.create_plan(request.goal, projects)
        notes: List[str] = list(plan.notes)

        job_id = None
        started = False
        if request.auto_start or plan.status == "planned":
            result = self.job_manager.create_job_from_goal(
                type("GoalRequest", (), {"goal": request.goal, "title": None, "auto_start": request.auto_start})()
            )
            job_id = result.job_id
            started = result.started
            notes.extend(result.notes)

        memory_snapshot: Dict[str, Any] = self.memory_manager.search(request.goal)
        self.memory_manager.remember_interaction(
            request.goal,
            {
                "intent": reasoning["intent"],
                "plan_status": plan.status,
                "route": route,
                "agent": selected_agent["name"],
            },
        )
        self.memory_manager.remember_task(request.goal, plan.status)

        return AuraOSExecutionResponse(
            goal=request.goal,
            intent=reasoning["intent"],
            reasoning=reasoning["reasoning"],
            plan_status=plan.status,
            planned_steps=len(plan.steps),
            job_id=job_id,
            started=started,
            route=route,
            memory_snapshot=memory_snapshot,
            notes=[f"agent={selected_agent['name']}"] + notes,
        )
