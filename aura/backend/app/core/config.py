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
    version: str = Field("1.0.0", alias="AURA_VERSION")
    api_prefix: str = Field("/api/v1", alias="AURA_API_PREFIX")
    auth_mode: str = Field("local", alias="AURA_AUTH_MODE")
    model_name: str = Field("qwen3.5:9b", alias="AURA_MODEL")
    ollama_url: str = Field("http://localhost:11434", alias="OLLAMA_URL")
    allowed_origins_raw: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000", alias="AURA_ALLOWED_ORIGINS"
    )
    auth_token: str = Field("change-me", alias="AURA_AUTH_TOKEN")
    require_auth: bool = Field(True, alias="AURA_REQUIRE_AUTH")
    projects_file: str = Field("./data/json/projects.json", alias="AURA_PROJECTS_FILE")
    settings_file: str = Field("./data/json/settings.json", alias="AURA_SETTINGS_FILE")
    audit_log_file: str = Field("./data/logs/audit.log", alias="AURA_AUDIT_LOG_FILE")
    audit_json_file: str = Field("./data/json/audit_logs.json", alias="AURA_AUDIT_JSON_FILE")
    chat_sessions_file: str = Field("./data/json/chat_sessions.json", alias="AURA_CHAT_SESSIONS_FILE")
    chat_messages_file: str = Field("./data/json/chat_messages.json", alias="AURA_CHAT_MESSAGES_FILE")
    command_timeout: int = Field(30, alias="AURA_COMMAND_TIMEOUT")
    llm_timeout: int = Field(120, alias="AURA_LLM_TIMEOUT")
    http_timeout: int = Field(20, alias="AURA_HTTP_TIMEOUT")
    default_projects_root: str = Field(
        str(Path.home() / "Projects"), alias="AURA_DEFAULT_PROJECTS_ROOT"
    )
    supabase_enabled: bool = Field(False, alias="AURA_SUPABASE_ENABLED")
    supabase_url: str = Field("", alias="SUPABASE_URL")
    supabase_anon_key: str = Field("", alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field("", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_db_password: str = Field("", alias="SUPABASE_DB_PASSWORD")

    @property
    def allowed_origins(self) -> List[str]:
        return [item.strip() for item in self.allowed_origins_raw.split(",") if item.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
