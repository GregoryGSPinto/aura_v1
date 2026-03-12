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
from app.aura_os.integrations.ollama import OllamaProvider
from app.aura_os.integrations.openai import OpenAIProvider
from app.aura_os.memory.manager import MemoryManager
from app.aura_os.tools.registry import ToolRegistry
from app.aura_os.tools.research.research_tool import ResearchTool
from app.aura_os.tools.research.scraper import WebScraper
from app.aura_os.tools.research.search_engine import SearchEngine
from app.aura_os.tools.research.summarizer import ResearchSummarizer
from app.aura_os.voice.pipeline import VoicePipeline
from app.agents.job_manager import AgentJobManager
from app.agents.planner import AgentPlanner
from app.agents.step_executor import AgentStepExecutor
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AuraError
from app.core.http_security import ensure_request_id
from app.core.logger import setup_logger
from app.models.common_models import ApiResponse, ErrorDetail
from app.services.auth_service import AuthService
from app.services.command_service import CommandService
from app.services.job_service import JobService
from app.services.memory_service import MemoryService
from app.services.ollama_service import OllamaService
from app.services.persistence_service import PersistenceService
from app.services.project_service import ProjectService
from app.services.supabase_service import SupabaseService
from app.tools import BrowserTool, FilesystemTool, LLMTool, ProjectTool, SystemTool, TerminalTool, ToolRouter, VSCodeTool


class Container:
    def __init__(self):
        self.settings = get_settings()
        self.logger = setup_logger(self.settings.audit_log_file)
        self.memory_service = MemoryService(
            settings_file=self.settings.settings_file,
            projects_file=self.settings.projects_file,
            audit_json_file=self.settings.audit_json_file,
            chat_sessions_file=self.settings.chat_sessions_file,
            chat_messages_file=self.settings.chat_messages_file,
            jobs_file=self.settings.jobs_file,
            job_logs_file=self.settings.job_logs_file,
        )
        self.supabase_service = SupabaseService(self.settings)
        self.persistence_service = PersistenceService(self.memory_service, self.supabase_service, self.logger)
        self.project_service = ProjectService(self.persistence_service)
        self.auth_service = AuthService(self.settings, self.supabase_service)
        self.ollama_service = OllamaService(self.settings)
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
        self.job_service = JobService(self.settings, self.memory_service, self.agent_step_executor, self.logger)
        self.agent_planner = AgentPlanner()
        self.agent_job_manager = AgentJobManager(self.agent_planner, self.job_service, self.project_service)
        self.aura_os_settings = AuraOSSettings(self.settings)
        self.memory_manager = MemoryManager(self.memory_service)
        self.tool_registry = ToolRegistry()
        self.tool_registry.register_defaults()
        self.voice_pipeline = VoicePipeline()
        self.reasoner = Reasoner()
        self.intent_router = IntentRouter(self.tool_router)
        self.planner_adapter = PlannerAdapter(self.agent_planner)
        self.tool_executor = ToolExecutor(self.command_service)
        self.agent_router = AgentRouter()
        self.model_router = ModelRouter(self.settings.model_name, self.aura_os_settings.model_routing())
        self.scheduler = WorkflowScheduler()
        self.ollama_provider = OllamaProvider(self.ollama_service, self.settings.model_name)
        self.openai_provider = OpenAIProvider(model_name="gpt-4o-mini")
        self.anthropic_provider = AnthropicProvider(model_name="claude-3-5-sonnet")
        self.research_search_engine = SearchEngine()
        self.research_scraper = WebScraper()
        self.research_summarizer = ResearchSummarizer(self.ollama_provider)
        self.research_tool = ResearchTool(self.research_search_engine, self.research_scraper, self.research_summarizer)
        self.aura_os = AuraOperatingSystem(
            settings=self.aura_os_settings,
            planner=self.planner_adapter,
            reasoner=self.reasoner,
            intent_router=self.intent_router,
            tool_executor=self.tool_executor,
            memory_manager=self.memory_manager,
            tool_registry=self.tool_registry,
            voice_pipeline=self.voice_pipeline,
            job_manager=self.agent_job_manager,
            agent_router=self.agent_router,
            model_router=self.model_router,
            scheduler=self.scheduler,
            ollama_provider=self.ollama_provider,
            openai_provider=self.openai_provider,
            anthropic_provider=self.anthropic_provider,
            research_tool=self.research_tool,
            list_projects_callable=self.project_service.list_projects,
        )
        self.voice_pipeline.attach_runtime(self.aura_os)


container = Container()


def get_container() -> Container:
    return container


def create_app() -> FastAPI:
    app = FastAPI(title="Aura API", version=container.settings.version)
    app.state.started_at = datetime.now(timezone.utc)
    app.state.settings = container.settings
    app.state.logger = container.logger
    app.state.memory_service = container.memory_service
    app.state.supabase_service = container.supabase_service
    app.state.persistence_service = container.persistence_service
    app.state.project_service = container.project_service
    app.state.auth_service = container.auth_service
    app.state.ollama_service = container.ollama_service
    app.state.terminal_tool = container.terminal_tool
    app.state.filesystem_tool = container.filesystem_tool
    app.state.vscode_tool = container.vscode_tool
    app.state.browser_tool = container.browser_tool
    app.state.system_tool = container.system_tool
    app.state.llm_tool = container.llm_tool
    app.state.project_tool = container.project_tool
    app.state.tool_router = container.tool_router
    app.state.command_service = container.command_service
    app.state.job_service = container.job_service
    app.state.agent_planner = container.agent_planner
    app.state.agent_job_manager = container.agent_job_manager
    app.state.aura_os = container.aura_os
    app.state.voice_pipeline = container.voice_pipeline
    app.state.research_tool = container.research_tool

    app.add_middleware(
        CORSMiddleware,
        allow_origins=container.settings.allowed_origins,
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

    app.include_router(api_router, prefix=container.settings.api_prefix)

    @app.on_event("startup")
    async def startup_event():
        container.job_service.start()

    @app.on_event("shutdown")
    async def shutdown_event():
        container.job_service.stop()

    @app.exception_handler(AuraError)
    async def aura_exception_handler(_: Request, exc: AuraError):
        response = ApiResponse(
            success=False,
            data=None,
            error=ErrorDetail(code=exc.code, message=exc.message, details=exc.details),
        )
        return JSONResponse(status_code=exc.status_code, content=response.model_dump(mode="json"))

    @app.get("/", response_model=ApiResponse[dict])
    async def root():
        return ApiResponse(
            data={
                "name": container.settings.app_name,
                "message": "Aura API ativa.",
                "docs": "/docs",
                "api_prefix": container.settings.api_prefix,
            }
        )

    return app


app = create_app()
