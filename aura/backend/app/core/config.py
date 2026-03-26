from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field("Aura", alias="AURA_APP_NAME")
    env: str = Field("development", alias="AURA_ENV")
    version: str = Field("1.1.0", alias="AURA_VERSION")
    api_prefix: str = Field("/api/v1", alias="AURA_API_PREFIX")
    auth_mode: str = Field("local", alias="AURA_AUTH_MODE")
    model_name: str = Field("qwen3.5:9b", alias="AURA_MODEL")
    ollama_url: str = Field("http://localhost:11434", alias="OLLAMA_URL")
    allowed_origins_raw: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000", alias="AURA_ALLOWED_ORIGINS"
    )
    auth_token: str = Field("change-me", alias="AURA_AUTH_TOKEN")
    require_auth: bool = Field(True, alias="AURA_REQUIRE_AUTH")
    local_mode: bool = Field(True, alias="AURA_LOCAL_MODE")
    enable_jobs: bool = Field(True, alias="AURA_ENABLE_JOBS")
    enable_routines: bool = Field(False, alias="AURA_ENABLE_ROUTINES")
    enable_voice: bool = Field(True, alias="AURA_ENABLE_VOICE")
    enable_os_runtime: bool = Field(False, alias="AURA_ENABLE_OS_RUNTIME")
    enable_research: bool = Field(False, alias="AURA_ENABLE_RESEARCH")
    enable_cloud_providers: bool = Field(False, alias="AURA_ENABLE_CLOUD_PROVIDERS")
    projects_file: str = Field("./data/json/projects.json", alias="AURA_PROJECTS_FILE")
    settings_file: str = Field("./data/json/settings.json", alias="AURA_SETTINGS_FILE")
    audit_log_file: str = Field("./data/logs/audit.log", alias="AURA_AUDIT_LOG_FILE")
    audit_json_file: str = Field("./data/json/audit_logs.json", alias="AURA_AUDIT_JSON_FILE")
    chat_sessions_file: str = Field("./data/json/chat_sessions.json", alias="AURA_CHAT_SESSIONS_FILE")
    chat_messages_file: str = Field("./data/json/chat_messages.json", alias="AURA_CHAT_MESSAGES_FILE")
    companion_memory_file: str = Field("./data/json/companion_memory.json", alias="AURA_COMPANION_MEMORY_FILE")
    jobs_file: str = Field("./data/json/jobs.json", alias="AURA_JOBS_FILE")
    job_logs_file: str = Field("./data/json/job_logs.json", alias="AURA_JOB_LOGS_FILE")
    routines_file: str = Field("./data/json/routines.json", alias="AURA_ROUTINES_FILE")
    routine_executions_file: str = Field("./data/json/routine_executions.json", alias="AURA_ROUTINE_EXECUTIONS_FILE")
    command_timeout: int = Field(30, alias="AURA_COMMAND_TIMEOUT")
    llm_timeout: int = Field(120, alias="AURA_LLM_TIMEOUT")
    http_timeout: int = Field(20, alias="AURA_HTTP_TIMEOUT")
    job_poll_interval: int = Field(2, alias="AURA_JOB_POLL_INTERVAL")
    rate_limit_window_seconds: int = Field(60, alias="AURA_RATE_LIMIT_WINDOW_SECONDS")
    rate_limit_auth_requests: int = Field(30, alias="AURA_RATE_LIMIT_AUTH_REQUESTS")
    rate_limit_chat_requests: int = Field(20, alias="AURA_RATE_LIMIT_CHAT_REQUESTS")
    rate_limit_command_requests: int = Field(20, alias="AURA_RATE_LIMIT_COMMAND_REQUESTS")
    default_projects_root: str = Field(
        str(Path.home() / "Projects"), alias="AURA_DEFAULT_PROJECTS_ROOT"
    )
    allowed_roots_raw: str = Field("", alias="AURA_ALLOWED_ROOTS")
    max_file_read_size: int = Field(65536, alias="AURA_MAX_FILE_READ_SIZE")
    supabase_enabled: bool = Field(False, alias="AURA_SUPABASE_ENABLED")
    supabase_url: str = Field("", alias="SUPABASE_URL")
    supabase_anon_key: str = Field("", alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field("", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_db_password: str = Field("", alias="SUPABASE_DB_PASSWORD")
    anthropic_api_key: str = Field("", alias="ANTHROPIC_API_KEY")
    claude_model: str = Field("claude-sonnet-4-20250514", alias="CLAUDE_MODEL")
    claude_daily_budget_cents: int = Field(200, alias="CLAUDE_DAILY_BUDGET_CENTS")
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    token_budget_daily_usd: float = Field(5.0, alias="TOKEN_BUDGET_DAILY_USD")
    token_budget_monthly_usd: float = Field(100.0, alias="TOKEN_BUDGET_MONTHLY_USD")
    vapid_public_key: str = Field("", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field("", alias="VAPID_PRIVATE_KEY")
    vapid_email: str = Field("mailto:gregory@aura.dev", alias="VAPID_EMAIL")
    github_token: str = Field("", alias="GITHUB_TOKEN")
    github_username: str = Field("", alias="GITHUB_USERNAME")
    vercel_token: str = Field("", alias="VERCEL_TOKEN")
    base_project_dir: str = Field(str(Path.home() / "Projetos"), alias="AURA_BASE_PROJECT_DIR")
    google_calendar_api_key: str = Field("", alias="GOOGLE_CALENDAR_API_KEY")
    google_calendar_id: str = Field("primary", alias="GOOGLE_CALENDAR_ID")
    gmail_address: str = Field("", alias="GMAIL_ADDRESS")
    gmail_app_password: str = Field("", alias="GMAIL_APP_PASSWORD")
    aura_admin_username: str = Field("admin", alias="AURA_ADMIN_USERNAME")
    aura_admin_password: str = Field("", alias="AURA_ADMIN_PASSWORD")

    @property
    def allowed_origins(self) -> List[str]:
        return [item.strip() for item in self.allowed_origins_raw.split(",") if item.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def allowed_roots(self) -> List[str]:
        configured = [item.strip() for item in self.allowed_roots_raw.split(",") if item.strip()]
        defaults = [str(Path.cwd().resolve()), str(Path(self.default_projects_root).expanduser().resolve())]
        return list(dict.fromkeys(configured + defaults))

    @property
    def feature_flags(self) -> dict:
        return {
            "local_mode": self.local_mode,
            "jobs": self.enable_jobs,
            "routines": self.enable_routines,
            "voice": self.enable_voice,
            "os_runtime": self.enable_os_runtime,
            "research": self.enable_research,
            "cloud_providers": self.enable_cloud_providers,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
