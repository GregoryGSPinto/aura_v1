from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agents.job_manager import AgentJobManager
from app.agents.planner import AgentPlanner
from app.agents.step_executor import AgentStepExecutor
from app.api.v1.router import api_router
from app.aura_os.agents.router import AgentRouter
from app.aura_os.automation.scheduler import WorkflowScheduler
from app.aura_os.config.models import AuraOSExecutionResponse, AuraOSOverview, VoiceStatus
from app.aura_os.config.settings import AuraOSSettings
from app.aura_os.core.agent import AuraOperatingSystem
from app.aura_os.core.planner import PlannerAdapter
from app.aura_os.core.reasoner import Reasoner
from app.aura_os.core.router import IntentRouter
from app.aura_os.core.tool_executor import ToolExecutor
from app.aura_os.integrations.anthropic import AnthropicProvider
from app.aura_os.integrations.model_router import ModelRouter
from app.aura_os.integrations.ollama import OllamaProvider
from app.aura_os.integrations.openai import OpenAIProvider
from app.aura_os.memory.manager import MemoryManager
from app.aura_os.tools.registry import ToolRegistry
from app.aura_os.tools.research.research_tool import ResearchTool
from app.aura_os.tools.research.scraper import WebScraper
from app.aura_os.tools.research.search_engine import SearchEngine
from app.aura_os.tools.research.summarizer import ResearchSummarizer
from app.aura_os.voice.pipeline import VoicePipeline
from app.core.config import get_settings
from app.core.exceptions import AuraError
from app.core.http_security import ensure_request_id
from app.core.logger import setup_logger
from app.models.common_models import ApiResponse, ErrorDetail
from app.services.action_governance_service import ActionGovernanceService
from app.services.auth_service import AuthService
from app.services.behavior_service import BehaviorService
from app.services.command_service import CommandService
from app.services.context_service import ContextService
from app.services.job_service import JobService
from app.services.memory_service import MemoryService
from app.services.ollama_service import OllamaService
from app.services.persistence_service import PersistenceService
from app.services.project_service import ProjectService
from app.services.routine_service import RoutineService
from app.services.supabase_service import SupabaseService
from app.tools import BrowserTool, FilesystemTool, LLMTool, ProjectTool, SystemTool, TerminalTool, ToolRouter, VSCodeTool


class NullVoicePipeline:
    def __init__(self, note: str = "Pipeline de voz desativado para o modo MVP local."):
        self.note = note

    def attach_runtime(self, aura_os) -> None:
        return None

    def process_once(self, transcript_hint: str, speak: bool = False) -> dict:
        return {"activated": False, "reason": "voice_disabled", "transcript": transcript_hint, "speak": speak}

    def status(self) -> VoiceStatus:
        return VoiceStatus(stt_ready=False, tts_ready=False, wake_word="Aura", pipeline_ready=False, notes=[self.note])


class NullResearchTool:
    async def research(self, query: str, limit: int = 3) -> dict:
        return {
            "query": query,
            "limit": limit,
            "summary": "Pesquisa desativada no modo MVP local.",
            "sources": [],
            "status": "disabled",
        }


class NullAuraOS:
    def __init__(self, settings, reason: str):
        self.settings = settings
        self.reason = reason
        self.agent_router = AgentRouter()
        self.model_router = ModelRouter(settings.model_name, AuraOSSettings(settings).model_routing())

    async def overview(self) -> AuraOSOverview:
        return AuraOSOverview(
            name="Aura Personal AI Operating System",
            version=self.settings.version,
            voice=VoiceStatus(
                stt_ready=False,
                tts_ready=False,
                wake_word="Aura",
                pipeline_ready=False,
                notes=[self.reason],
            ),
            model_router={"default_model": self.settings.model_name, "status": "disabled"},
            automation={"status": "disabled"},
            policies={"mode": "local-mvp"},
        )

    def execute(self, request) -> AuraOSExecutionResponse:
        return AuraOSExecutionResponse(
            goal=request.goal,
            intent="conversa",
            reasoning=self.reason,
            plan_status="disabled",
            planned_steps=0,
            started=False,
            route=None,
            memory_snapshot={},
            notes=[self.reason],
        )


class Container:
    def __init__(self):
        self.settings = get_settings()
        self.logger = setup_logger(self.settings.audit_log_file)
        self.startup_warnings: list[str] = []
        self.feature_flags = dict(self.settings.feature_flags)

        self.memory_service = MemoryService(
            settings_file=self.settings.settings_file,
            projects_file=self.settings.projects_file,
            audit_json_file=self.settings.audit_json_file,
            chat_sessions_file=self.settings.chat_sessions_file,
            chat_messages_file=self.settings.chat_messages_file,
            companion_memory_file=self.settings.companion_memory_file,
            jobs_file=self.settings.jobs_file,
            job_logs_file=self.settings.job_logs_file,
            routines_file=self.settings.routines_file,
            routine_executions_file=self.settings.routine_executions_file,
        )
        self.supabase_service = SupabaseService(self.settings)
        self.persistence_service = PersistenceService(self.memory_service, self.supabase_service, self.logger)
        self.project_service = ProjectService(self.persistence_service)
        self.auth_service = AuthService(self.settings, self.supabase_service)
        self.ollama_service = OllamaService(self.settings)
        self.behavior_service = BehaviorService()
        self.action_governance_service = ActionGovernanceService()
        self.context_service = ContextService(self.memory_service, self.behavior_service)
        self.terminal_tool = TerminalTool(self.settings)
        self.filesystem_tool = FilesystemTool(self.settings)
        self.vscode_tool = VSCodeTool()
        self.browser_tool = BrowserTool()
        self.system_tool = SystemTool(self.settings)
        self.llm_tool = LLMTool(self.ollama_service)
        self.project_tool = ProjectTool(self.project_service, self.terminal_tool, self.vscode_tool)
        self.tool_router = ToolRouter()
        self.command_service = CommandService(
            self.persistence_service,
            self.project_tool,
            self.terminal_tool,
            self.vscode_tool,
            self.system_tool,
            self.logger,
        )
        self.agent_step_executor = AgentStepExecutor(self.command_service)
        self.agent_planner = AgentPlanner()
        self.job_service = JobService(self.settings, self.memory_service, self.agent_step_executor, self.logger)
        self.agent_job_manager = AgentJobManager(self.agent_planner, self.job_service, self.project_service)
        self.routine_service = RoutineService(self.settings, self.memory_service)

        self.voice_pipeline = self._build_voice_pipeline()
        self.research_tool = self._build_research_tool()
        self.aura_os = self._build_aura_os()

    def _warn(self, message: str) -> None:
        self.startup_warnings.append(message)
        self.logger.warning(message)

    def _build_voice_pipeline(self):
        if not self.settings.enable_voice:
            self._warn("Voice pipeline desativado por feature flag.")
            return NullVoicePipeline()
        try:
            return VoicePipeline()
        except Exception as exc:
            self._warn(f"Voice pipeline indisponível; fallback inativo aplicado. Detalhe: {exc}")
            return NullVoicePipeline(note="Pipeline de voz indisponível no bootstrap.")

    def _build_research_tool(self):
        if not self.settings.enable_research:
            self._warn("Research runtime desativado por feature flag.")
            return NullResearchTool()
        try:
            provider = OllamaProvider(self.ollama_service, self.settings.model_name)
            return ResearchTool(SearchEngine(), WebScraper(), ResearchSummarizer(provider))
        except Exception as exc:
            self._warn(f"Research runtime indisponível; fallback desativado aplicado. Detalhe: {exc}")
            return NullResearchTool()

    def _build_aura_os(self):
        if not self.settings.enable_os_runtime:
            self._warn("Aura OS runtime avançado desativado por feature flag.")
            return NullAuraOS(self.settings, "Aura OS runtime desativado no modo MVP local.")

        try:
            aura_os_settings = AuraOSSettings(self.settings)
            memory_manager = MemoryManager(self.memory_service)
            tool_registry = ToolRegistry()
            tool_registry.register_defaults()
            reasoner = Reasoner()
            intent_router = IntentRouter(self.tool_router)
            planner_adapter = PlannerAdapter(self.agent_planner)
            tool_executor = ToolExecutor(self.command_service)
            agent_router = AgentRouter()
            model_router = ModelRouter(self.settings.model_name, aura_os_settings.model_routing())
            scheduler = WorkflowScheduler()
            ollama_provider = OllamaProvider(self.ollama_service, self.settings.model_name)
            openai_provider = OpenAIProvider(model_name="gpt-4o-mini") if self.settings.enable_cloud_providers else OpenAIProvider()
            anthropic_provider = (
                AnthropicProvider(model_name="claude-3-5-sonnet") if self.settings.enable_cloud_providers else AnthropicProvider()
            )
            aura_os = AuraOperatingSystem(
                settings=aura_os_settings,
                planner=planner_adapter,
                reasoner=reasoner,
                intent_router=intent_router,
                tool_executor=tool_executor,
                memory_manager=memory_manager,
                tool_registry=tool_registry,
                voice_pipeline=self.voice_pipeline,
                job_manager=self.agent_job_manager,
                agent_router=agent_router,
                model_router=model_router,
                scheduler=scheduler,
                ollama_provider=ollama_provider,
                openai_provider=openai_provider,
                anthropic_provider=anthropic_provider,
                research_tool=self.research_tool,
                list_projects_callable=self.project_service.list_projects,
            )
            self.voice_pipeline.attach_runtime(aura_os)
            return aura_os
        except Exception as exc:
            self._warn(f"Aura OS runtime indisponível; fallback degradado aplicado. Detalhe: {exc}")
            return NullAuraOS(self.settings, "Aura OS runtime indisponível no bootstrap.")

    def start_runtime(self) -> None:
        if self.settings.enable_jobs:
            try:
                self.job_service.start()
            except Exception as exc:
                self._warn(f"Job service não iniciou; MVP seguirá sem worker assíncrono. Detalhe: {exc}")
        else:
            self._warn("Job service desativado por feature flag.")

        if self.settings.enable_routines:
            try:
                self.routine_service.start()
            except Exception as exc:
                self._warn(f"Routine scheduler não iniciou; MVP seguirá sem rotinas. Detalhe: {exc}")
        else:
            self._warn("Routine scheduler desativado por feature flag.")

    def stop_runtime(self) -> None:
        try:
            self.routine_service.stop()
        except Exception:
            pass
        try:
            self.job_service.stop()
        except Exception:
            pass


container: Optional[Container] = None


def get_container() -> Container:
    global container
    if container is None:
        container = Container()
    return container


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.container.start_runtime()
    yield
    app.state.container.stop_runtime()


def create_app() -> FastAPI:
    app_container = get_container()
    app = FastAPI(title="Aura API", version=app_container.settings.version, lifespan=lifespan)
    app.state.started_at = datetime.now(timezone.utc)
    app.state.container = app_container
    app.state.settings = app_container.settings
    app.state.logger = app_container.logger
    app.state.memory_service = app_container.memory_service
    app.state.supabase_service = app_container.supabase_service
    app.state.persistence_service = app_container.persistence_service
    app.state.project_service = app_container.project_service
    app.state.auth_service = app_container.auth_service
    app.state.ollama_service = app_container.ollama_service
    app.state.behavior_service = app_container.behavior_service
    app.state.action_governance_service = app_container.action_governance_service
    app.state.context_service = app_container.context_service
    app.state.terminal_tool = app_container.terminal_tool
    app.state.filesystem_tool = app_container.filesystem_tool
    app.state.vscode_tool = app_container.vscode_tool
    app.state.browser_tool = app_container.browser_tool
    app.state.system_tool = app_container.system_tool
    app.state.llm_tool = app_container.llm_tool
    app.state.project_tool = app_container.project_tool
    app.state.tool_router = app_container.tool_router
    app.state.command_service = app_container.command_service
    app.state.job_service = app_container.job_service
    app.state.agent_planner = app_container.agent_planner
    app.state.agent_job_manager = app_container.agent_job_manager
    app.state.aura_os = app_container.aura_os
    app.state.voice_pipeline = app_container.voice_pipeline
    app.state.research_tool = app_container.research_tool
    app.state.routine_service = app_container.routine_service
    app.state.startup_warnings = app_container.startup_warnings
    app.state.feature_flags = app_container.feature_flags

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_container.settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        request_id = ensure_request_id(request)
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    app.include_router(api_router, prefix=app_container.settings.api_prefix)

    @app.exception_handler(AuraError)
    async def aura_exception_handler(_: Request, exc: AuraError):
        response = ApiResponse(
            success=False,
            data=None,
            error=ErrorDetail(code=exc.code, message=exc.message, details=exc.details),
        )
        return JSONResponse(status_code=exc.status_code, content=response.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request.app.state.logger.exception("Unhandled Aura exception: %s", exc)
        response = ApiResponse(
            success=False,
            data=None,
            error=ErrorDetail(
                code="internal_error",
                message="Falha interna não tratada no backend da Aura.",
                details={"type": exc.__class__.__name__},
            ),
        )
        return JSONResponse(status_code=500, content=response.model_dump(mode="json"))

    @app.get("/", response_model=ApiResponse[dict])
    async def root():
        return ApiResponse(
            data={
                "name": app_container.settings.app_name,
                "message": "Aura API ativa.",
                "docs": "/docs",
                "api_prefix": app_container.settings.api_prefix,
                "feature_flags": app_container.settings.feature_flags,
            }
        )

    return app


app = create_app()
