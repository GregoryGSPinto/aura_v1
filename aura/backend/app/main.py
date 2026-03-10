from app.agents.job_manager import AgentJobManager
from app.agents.planner import AgentPlanner
from app.agents.step_executor import AgentStepExecutor
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AuraError
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
        self.command_service = CommandService(
            self.settings,
            self.project_service,
            self.persistence_service,
            self.logger,
        )
        self.agent_step_executor = AgentStepExecutor(self.command_service)
        self.job_service = JobService(self.settings, self.memory_service, self.agent_step_executor, self.logger)
        self.agent_planner = AgentPlanner()
        self.agent_job_manager = AgentJobManager(self.agent_planner, self.job_service, self.project_service)


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
    app.state.command_service = container.command_service
    app.state.job_service = container.job_service
    app.state.agent_planner = container.agent_planner
    app.state.agent_job_manager = container.agent_job_manager

    app.add_middleware(
        CORSMiddleware,
        allow_origins=container.settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
