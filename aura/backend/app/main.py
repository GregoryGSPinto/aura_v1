import os
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
from app.services.connector_validation_service import ConnectorValidationService
from app.services.context_service import ContextService
from app.services.credential_store import SecureCredentialStore
from app.services.google_oauth_service import GoogleOAuthService
from app.services.job_service import JobService
from app.services.memory_service import MemoryService
from app.services.ollama_engine_service import OllamaEngineService
from app.services.ollama_service import OllamaService
from app.services.persistence_service import PersistenceService
from app.services.project_service import ProjectService
from app.services.routine_service import RoutineService
from app.services.supabase_service import SupabaseService
from app.services.token_budget_service import TokenBudgetService
from app.services.voice_session_manager import VoiceSessionManager
from app.services.brain_router import BrainRouter
from app.services.chat_router_service import ChatRouterService
from app.services.claude_client import ClaudeClient
from app.services.tool_schema_service import ToolSchemaService
from app.services.tool_call_parser import ToolCallParser
from app.services.tool_executor_service import ToolExecutorService
from app.services.knowledge_extractor import KnowledgeExtractor
from app.services.claude_bridge import ClaudeBridge
from app.services.daily_briefing import DailyBriefingService
from app.services.deploy_orchestrator import DeployOrchestrator
from app.services.github_service import GitHubService
from app.services.integrations_service import DocService
from app.services.mission_engine import MissionExecutor, MissionPlanner, MissionStore
from app.services.mission_engine_v2 import BlockerDetector, MissionEvaluator, MissionReplanner, MissionSummarizer, SmartRetry
from app.services.mission_control import MissionControlService
from app.services.proactive_engine import ProactiveEngine
from app.services.safety_service import ApprovalQueue, AuditService, RollbackRegistry, SafetyService
from app.services.sqlite_memory import SQLiteMemoryService
from app.services.vercel_service import VercelService
from app.services.voice_service import STTService, TTSService
from app.services.whatsapp_service import OfficialWhatsAppConnector, PersonalWhatsAppBridgeConnector
from app.services.whatsapp_router import WhatsAppRouter
from app.services.proactive_service import ProactiveService
from app.services.push_service import PushService
from app.services.workflow_engine import WorkflowEngine
from app.aura_os.connectors.github_connector import GitHubConnector
from app.aura_os.connectors.calendar_connector import GoogleCalendarConnector
from app.aura_os.connectors.gmail_connector import GmailConnector
from app.tools import BrowserTool, ClaudeTool, DocTool, FilesystemTool, GitTool, LLMTool, ProjectTool, SystemTool, TerminalTool, ToolRegistryV2, ToolRouter, VSCodeTool, create_tool_registry
from app.tools.dev_tool import DevTool
from app.services.agent_service import AgentService
from app.services.ollama_lifecycle import OllamaLifecycle
from app.services.memory_engine import MemoryEngine
from app.services.proactive_agent import ProactiveAgent


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
        self.credential_store = SecureCredentialStore(
            base_dir=str(os.path.join(os.path.dirname(self.settings.settings_file), "secure")),
            master_key=self.settings.credential_store_master_key,
        )
        self.google_oauth_service = GoogleOAuthService(
            settings=self.settings,
            credential_store=self.credential_store,
            data_dir=str(os.path.join(os.path.dirname(self.settings.settings_file), "oauth")),
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
        self.claude_tool = ClaudeTool()
        self.git_tool = GitTool(self.settings)
        self.doc_tool = DocTool(self.settings)
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
        self.token_budget_service = TokenBudgetService(
            daily_limit_usd=self.settings.token_budget_daily_usd,
            monthly_limit_usd=self.settings.token_budget_monthly_usd,
        )

        self.ollama_engine_service = OllamaEngineService(
            ollama_url=self.settings.ollama_url,
            model_name=self.settings.model_name,
        )

        # Sprint 0 — Brain Router + Claude Client
        self.claude_client = ClaudeClient(
            api_key=self.settings.anthropic_api_key,
            model=self.settings.claude_model,
        )
        self.brain_router = BrainRouter(
            cloud_available=self.claude_client.available,
            daily_budget_cents=self.settings.claude_daily_budget_cents,
        )

        self.ollama_provider = OllamaProvider(self.ollama_service, self.settings.model_name)
        self.openai_provider = (
            OpenAIProvider(api_key=self.settings.openai_api_key, model_name="gpt-4o-mini")
            if self.settings.openai_api_key
            else OpenAIProvider()
        )
        self.anthropic_provider = (
            AnthropicProvider(api_key=self.settings.anthropic_api_key, model_name="claude-sonnet-4-20250514")
            if self.settings.anthropic_api_key
            else AnthropicProvider()
        )
        self.provider_override = "auto"

        self.voice_pipeline = self._build_voice_pipeline()
        self.research_tool = self._build_research_tool()
        self.aura_os = self._build_aura_os()

        # Sprint 1+2: Chat Router with Tool Calling
        self.tool_schema_service = ToolSchemaService(self.tool_router, self.action_governance_service)
        self.tool_call_parser = ToolCallParser()
        self.tool_executor_service = ToolExecutorService(
            tools={
                "terminal": self.terminal_tool,
                "filesystem": self.filesystem_tool,
                "browser": self.browser_tool,
                "vscode": self.vscode_tool,
                "project": self.project_tool,
                "system": self.system_tool,
                "research": self.research_tool,
                "claude": self.claude_tool,
            },
            governance=self.action_governance_service,
            persistence=self.persistence_service,
        )
        # Sprint 4: Tool Registry V2 (unified)
        self.tool_registry_v2 = ToolRegistryV2()
        self.tool_registry_v2.register("terminal", self.terminal_tool, "Executar comandos no terminal", parameters={"command": "string", "working_dir": "string (opcional)"})
        self.tool_registry_v2.register("filesystem", self.filesystem_tool, "Operações com arquivos e diretórios", parameters={"path": "string"})
        self.tool_registry_v2.register("git", self.git_tool, "Operações Git estruturadas", parameters={"repo_path": "string"})
        self.tool_registry_v2.register("browser", self.browser_tool, "Acessar e buscar URLs")
        self.tool_registry_v2.register("doc", self.doc_tool, "Ler e buscar em documentos/código")
        self.tool_registry_v2.register("system", self.system_tool, "Monitoramento do sistema")
        self.tool_registry_v2.register("project", self.project_tool, "Gerenciamento de projetos")

        # AuraDev: DevTool for autonomous development
        self.dev_tool = DevTool()
        self.tool_registry_v2.register(
            "auradev", self.dev_tool,
            "Motor de desenvolvimento autônomo — gera código, corrige erros, faz review, gera testes",
            parameters={"task": "string", "project": "string (opcional)", "provider": "string (opcional)"},
        )

        # Sprint 3: SQLite Memory
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "memory.db")
        self.sqlite_memory = SQLiteMemoryService(db_path=db_path)

        # GTM Strategy bridge
        from app.services.gtm_service import GTMService
        gtm_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "gtm.db")
        self.gtm_service = GTMService(db_path=gtm_db_path)

        # Sprint 5: Claude Bridge (with SQLite memory for project context)
        self.claude_bridge = ClaudeBridge(sqlite_memory=self.sqlite_memory)
        self.tool_registry_v2.register("claude", self.claude_bridge, "Executar missões via Claude Code CLI", parameters={"objective": "string", "project_slug": "string", "working_dir": "string (opcional)"})

        # Sprint 6: GitHub + Vercel + Deploy Orchestrator
        self.github_service = GitHubService(
            token=self.settings.github_token,
            username=self.settings.github_username,
        )
        self.vercel_service = VercelService(
            token=self.settings.vercel_token,
            github_username=self.settings.github_username,
        )
        self.deploy_orchestrator = DeployOrchestrator(
            github_service=self.github_service,
            vercel_service=self.vercel_service,
            sqlite_memory=self.sqlite_memory,
        )
        self.tool_registry_v2.register("github", self.github_service, "Operacoes GitHub API")
        self.tool_registry_v2.register("vercel", self.vercel_service, "Operacoes Vercel API")
        self.tool_registry_v2.register("supabase", self.supabase_service, "Operacoes Supabase e health checks")
        self.tool_registry_v2.register("deploy_orchestrator", self.deploy_orchestrator, "Fluxo canonico de GitHub + Vercel")

        # Sprint 11: Safety Layer
        self.safety_service = SafetyService()
        self.audit_service = AuditService(db_path=db_path)
        self.approval_queue = ApprovalQueue()
        self.rollback_registry = RollbackRegistry()

        # Sprint 7: Mission Engine V1
        self.mission_store = MissionStore(db_path=db_path)
        self.mission_planner = MissionPlanner(ollama_service=self.ollama_service)
        self.mission_executor = MissionExecutor(
            tool_registry=self.tool_registry_v2,
            claude_bridge=self.claude_bridge,
            sqlite_memory=self.sqlite_memory,
            approval_queue=self.approval_queue,
            audit_service=self.audit_service,
            rollback_registry=self.rollback_registry,
            command_service=self.command_service,
        )

        self.chat_router_service = ChatRouterService(
            ollama_service=self.ollama_service,
            aura_os=self.aura_os,
            behavior_service=self.behavior_service,
            action_governance=self.action_governance_service,
            mission_control=None,
            tool_schema=self.tool_schema_service,
            tool_parser=self.tool_call_parser,
            tool_executor=self.tool_executor_service,
            tool_registry_v2=self.tool_registry_v2,
        )

        # Sprint 4: Knowledge Extractor (with Sprint 3 SQLite memory)
        self.knowledge_extractor = KnowledgeExtractor(
            memory_service=self.memory_service,
            ollama_service=self.ollama_service,
            budget_service=self.token_budget_service,
            sqlite_memory=self.sqlite_memory,
        )

        # Sprint 5: Connectors
        self.github_connector = GitHubConnector(
            token=self.settings.github_token,
            username=self.settings.github_username,
        )
        self.calendar_connector = GoogleCalendarConnector(
            settings=self.settings,
            credential_store=self.credential_store,
        )
        self.gmail_connector = GmailConnector(
            settings=self.settings,
            credential_store=self.credential_store,
        )
        self.whatsapp_official_connector = OfficialWhatsAppConnector(self.settings)
        self.whatsapp_personal_connector = PersonalWhatsAppBridgeConnector(self.settings)
        self.whatsapp_router = WhatsAppRouter(
            official_channel=self.whatsapp_official_connector,
            personal_bridge=self.whatsapp_personal_connector,
        )
        self.tool_registry_v2.register("gmail", self.gmail_connector, "Operacoes oficiais do Gmail via Google OAuth")
        self.tool_registry_v2.register("calendar", self.calendar_connector, "Operacoes oficiais do Google Calendar via OAuth")
        self.tool_registry_v2.register("whatsapp", self.whatsapp_router, "Router canônico do WhatsApp com governança e decisão official/bridge")

        # Push Service
        self.push_service = PushService(
            vapid_public_key=self.settings.vapid_public_key,
            vapid_private_key=self.settings.vapid_private_key,
            vapid_email=self.settings.vapid_email,
        )

        # Workflow Engine
        self.workflow_engine = WorkflowEngine(push_service=self.push_service)

        # Sprint 9+: Docs remain as standalone helper; Gmail/Calendar usam conectores canônicos.
        self.doc_service = DocService(
            ollama_service=self.ollama_service,
            allowed_roots=self.settings.allowed_roots,
        )

        # Sprint 12: Voice Premium
        self.stt_service = STTService()
        self.tts_service = TTSService()
        self.voice_session_manager = VoiceSessionManager(
            data_dir=str(os.path.join(os.path.dirname(self.settings.settings_file), "runtime"))
        )

        # Sprint 13.5: Proactive Engine
        self.proactive_engine = ProactiveEngine(
            ollama_service=self.ollama_service,
            claude_client=self.claude_client,
        )

        # Sprint 14: Daily Briefing
        self.briefing_service = DailyBriefingService(
            calendar_service=self.calendar_connector,
            email_service=self.gmail_connector,
            sqlite_memory=self.sqlite_memory,
            mission_store=self.mission_store,
            ollama_service=self.ollama_service,
            deploy_orchestrator=self.deploy_orchestrator,
        )

        # Sprint 15: Mission Engine V2
        self.mission_replanner = MissionReplanner(ollama_service=self.ollama_service)
        self.smart_retry = SmartRetry()
        self.blocker_detector = BlockerDetector()
        self.mission_evaluator = MissionEvaluator()
        self.mission_summarizer = MissionSummarizer(ollama_service=self.ollama_service)
        self.mission_control = MissionControlService(
            store=self.mission_store,
            planner=self.mission_planner,
            executor=self.mission_executor,
            evaluator=self.mission_evaluator,
            summarizer=self.mission_summarizer,
            blocker_detector=self.blocker_detector,
            smart_retry=self.smart_retry,
            replanner=self.mission_replanner,
            settings=self.settings,
            voice_pipeline=self.voice_pipeline,
            connectors={
                "github": self.github_connector,
                "gmail": self.gmail_connector,
                "calendar": self.calendar_connector,
                "vercel": self.vercel_service,
                "supabase": self.supabase_service,
                "whatsapp": self.whatsapp_router,
            },
            model_router=getattr(self.aura_os, "model_router", None),
            startup_warnings=self.startup_warnings,
            token_budget_service=self.token_budget_service,
            approval_queue=self.approval_queue,
            audit_service=self.audit_service,
            rollback_registry=self.rollback_registry,
            voice_session_manager=self.voice_session_manager,
            validation_service=None,
        )
        self.connector_validation_service = ConnectorValidationService(
            data_dir=str(os.path.join(os.path.dirname(self.settings.settings_file), "runtime")),
            connectors={
                "gmail": self.gmail_connector,
                "calendar": self.calendar_connector,
                "supabase": self.supabase_service,
                "whatsapp_official": self.whatsapp_official_connector,
                "whatsapp_personal": self.whatsapp_personal_connector,
                "whatsapp": self.whatsapp_router,
            },
            mission_control=self.mission_control,
        )
        self.mission_control.validation_service = self.connector_validation_service
        self.chat_router_service.mission_control = self.mission_control

        # Ollama Lifecycle (auto start/stop)
        self.ollama_lifecycle = OllamaLifecycle(
            ollama_url=self.settings.ollama_url,
            model_name=self.settings.model_name,
        )

        # Agent Tool Layer + Agent Service (Mega Prompt)
        self.agent_tool_registry = create_tool_registry()
        self.agent_service = AgentService(
            tool_registry=self.agent_tool_registry,
            brain_router=self.brain_router,
            claude_client=self.claude_client,
            ollama_service=self.ollama_service,
            settings=self.settings,
            ollama_lifecycle=self.ollama_lifecycle,
        )

        # AGI: Memory Engine (facade async over SQLiteMemoryService)
        self.memory_engine = MemoryEngine(db_path=db_path)

        # AGI: Proactive Agent (greeting + background monitoring)
        self.proactive_agent = ProactiveAgent(
            memory=self.memory_engine,
            agent_service=self.agent_service,
            ollama_lifecycle=self.ollama_lifecycle,
        )

        # Inject memory into AgentService
        self.agent_service.memory = self.memory_engine

        # Sprint 4: Proactive Service
        self.proactive_service = ProactiveService(
            scheduler=None,
            ollama_service=self.ollama_service,
            memory_service=self.memory_service,
            persistence=self.persistence_service,
            github=self.github_connector,
            calendar=self.calendar_connector,
            gmail=self.gmail_connector,
            push_service=self.push_service,
        )

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
            scheduler = WorkflowScheduler()
            ollama_provider = self.ollama_provider
            openai_provider = self.openai_provider
            anthropic_provider = self.anthropic_provider
            model_router = ModelRouter(
                self.settings.model_name,
                aura_os_settings.model_routing(),
                providers={
                    "ollama": ollama_provider,
                    "openai": openai_provider,
                    "anthropic": anthropic_provider,
                },
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

    # Sprint 1 — boot validation + background health polling
    from app.services.health import health_registry
    from app.services.operation_log import operation_log

    app.state.health_registry = health_registry
    app.state.operation_log = operation_log

    operation_log.add("info", "boot", "Aura backend starting up")
    await health_registry.boot_check()
    await health_registry.start_background(interval=30)
    operation_log.add("info", "boot", "Boot check completed, background health polling started")

    # Initialize MemoryEngine (async)
    try:
        await app.state.memory_engine.init_db()
        operation_log.add("info", "boot", "MemoryEngine initialized")
    except Exception as exc:
        app.state.logger.warning("[Lifespan] MemoryEngine did not initialize: %s", exc)

    try:
        await app.state.proactive_service.start()
        operation_log.add("info", "boot", "ProactiveService started (morning_briefing + health_check loops)")
    except Exception as exc:
        app.state.logger.warning("[Lifespan] ProactiveService did not start: %s", exc)

    # Start ProactiveAgent background monitor
    try:
        await app.state.proactive_agent.start()
        operation_log.add("info", "boot", "ProactiveAgent started (greeting + monitor)")
    except Exception as exc:
        app.state.logger.warning("[Lifespan] ProactiveAgent did not start: %s", exc)

    yield

    await app.state.proactive_agent.stop()
    await app.state.proactive_service.stop()
    await health_registry.stop_background()
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
    app.state.credential_store = app_container.credential_store
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
    app.state.voice_session_manager = app_container.voice_session_manager
    app.state.whatsapp_official_connector = app_container.whatsapp_official_connector
    app.state.whatsapp_personal_connector = app_container.whatsapp_personal_connector
    app.state.research_tool = app_container.research_tool
    app.state.claude_tool = app_container.claude_tool
    app.state.routine_service = app_container.routine_service
    app.state.token_budget_service = app_container.token_budget_service
    app.state.ollama_engine_service = app_container.ollama_engine_service
    app.state.provider_override = app_container.provider_override
    app.state.chat_providers = {
        "ollama": app_container.ollama_provider,
        "anthropic": app_container.anthropic_provider,
        "openai": app_container.openai_provider,
    }
    from app.services.websocket_manager import ws_manager as _ws_manager
    app.state.ws_manager = _ws_manager
    app.state.brain_router = app_container.brain_router
    app.state.claude_client = app_container.claude_client
    app.state.startup_warnings = app_container.startup_warnings
    app.state.feature_flags = app_container.feature_flags
    app.state.chat_router_service = app_container.chat_router_service
    app.state.tool_schema_service = app_container.tool_schema_service
    app.state.tool_call_parser = app_container.tool_call_parser
    app.state.tool_executor_service = app_container.tool_executor_service
    app.state.tool_registry_v2 = app_container.tool_registry_v2
    app.state.git_tool = app_container.git_tool
    app.state.doc_tool = app_container.doc_tool
    app.state.knowledge_extractor = app_container.knowledge_extractor
    app.state.push_service = app_container.push_service
    app.state.workflow_engine = app_container.workflow_engine
    app.state.sqlite_memory = app_container.sqlite_memory
    app.state.gtm_service = app_container.gtm_service
    app.state.claude_bridge = app_container.claude_bridge
    app.state.github_service = app_container.github_service
    app.state.vercel_service = app_container.vercel_service
    app.state.deploy_orchestrator = app_container.deploy_orchestrator
    app.state.mission_store = app_container.mission_store
    app.state.mission_planner = app_container.mission_planner
    app.state.mission_executor = app_container.mission_executor
    app.state.mission_control = app_container.mission_control
    app.state.doc_service = app_container.doc_service
    app.state.google_oauth_service = app_container.google_oauth_service
    app.state.connector_validation_service = app_container.connector_validation_service
    app.state.safety_service = app_container.safety_service
    app.state.audit_service = app_container.audit_service
    app.state.approval_queue = app_container.approval_queue
    app.state.rollback_registry = app_container.rollback_registry
    app.state.stt_service = app_container.stt_service
    app.state.tts_service = app_container.tts_service
    app.state.proactive_engine = app_container.proactive_engine
    app.state.briefing_service = app_container.briefing_service
    app.state.blocker_detector = app_container.blocker_detector
    app.state.mission_evaluator = app_container.mission_evaluator
    app.state.mission_summarizer = app_container.mission_summarizer
    app.state.dev_tool = app_container.dev_tool
    app.state.active_project = None
    app.state.proactive_service = app_container.proactive_service
    app.state.github_connector = app_container.github_connector
    app.state.calendar_connector = app_container.calendar_connector
    app.state.gmail_connector = app_container.gmail_connector
    app.state.whatsapp_router = app_container.whatsapp_router
    app.state.ollama_lifecycle = app_container.ollama_lifecycle
    app.state.agent_tool_registry = app_container.agent_tool_registry
    app.state.agent_service = app_container.agent_service
    app.state.memory_engine = app_container.memory_engine
    app.state.proactive_agent = app_container.proactive_agent

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_container.settings.allowed_origins,
        allow_origin_regex=r"https://.*\.(vercel\.app|trycloudflare\.com)",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
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
