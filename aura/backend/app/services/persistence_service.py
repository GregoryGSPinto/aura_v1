from typing import Any, Dict, List, Optional

from app.models.persistence_models import AuditLogEntry, ChatMessageRecord, ChatSessionRecord, PersistenceState
from app.services.memory_service import MemoryService
from app.services.supabase_service import SupabaseService


class PersistenceService:
    def __init__(self, memory_service: MemoryService, supabase_service: SupabaseService, logger):
        self.memory_service = memory_service
        self.supabase_service = supabase_service
        self.logger = logger

    def get_state(self) -> PersistenceState:
        warnings: List[str] = []
        mode = "local"
        if self.supabase_service.settings.supabase_enabled and not self.supabase_service.settings.supabase_configured:
            warnings.append("Supabase habilitado sem credenciais completas; fallback local ativo.")
            mode = "fallback-local"
        elif self.supabase_service.is_enabled():
            mode = "supabase"

        return PersistenceState(
            mode=mode,
            supabase_enabled=self.supabase_service.settings.supabase_enabled,
            supabase_configured=self.supabase_service.settings.supabase_configured,
            auth_mode=self.supabase_service.settings.auth_mode,
            warnings=warnings,
        )

    def list_projects(self) -> List[Dict[str, Any]]:
        local_projects = self.memory_service.get_projects()
        if not self.supabase_service.is_enabled():
            return local_projects

        try:
            remote_projects = self.supabase_service.fetch_projects()
            if not remote_projects and local_projects:
                remote_projects = self.supabase_service.upsert_projects(local_projects)
            normalized = [self._normalize_project(project, "supabase") for project in remote_projects]
            self.memory_service.save_projects(normalized)
            return normalized
        except Exception as exc:
            self.logger.warning("Supabase indisponivel para projetos, usando fallback local: %s", exc)
            return [self._normalize_project(project, "local") for project in local_projects]

    def get_settings(self) -> Dict[str, Any]:
        local_settings = self.memory_service.get_settings()
        if not self.supabase_service.is_enabled():
            return local_settings
        try:
            remote_settings = self.supabase_service.fetch_settings()
            if not remote_settings and local_settings:
                self.supabase_service.upsert_settings(local_settings)
                return local_settings
            if remote_settings:
                self.memory_service.update_settings(remote_settings)
                return remote_settings
        except Exception as exc:
            self.logger.warning("Supabase indisponivel para settings, usando fallback local: %s", exc)
        return local_settings

    def update_settings(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        local = self.memory_service.update_settings(updates)
        if self.supabase_service.is_enabled():
            try:
                self.supabase_service.upsert_settings(local)
            except Exception as exc:
                self.logger.warning("Falha ao sincronizar settings no Supabase: %s", exc)
        return local

    def record_audit_log(self, entry: AuditLogEntry) -> AuditLogEntry:
        self.memory_service.append_audit_log(entry)
        if self.supabase_service.is_enabled():
            try:
                self.supabase_service.insert_audit_log(entry)
            except Exception as exc:
                self.logger.warning("Falha ao enviar audit log ao Supabase: %s", exc)
        return entry

    def get_recent_audit_logs(self, limit: int = 40) -> List[Dict[str, Any]]:
        if self.supabase_service.is_enabled():
            try:
                return self.supabase_service.get_recent_audit_logs(limit)
            except Exception as exc:
                self.logger.warning("Falha ao ler audit logs do Supabase: %s", exc)
        return self.memory_service.get_recent_audit_logs(limit)

    def upsert_chat_session(self, session: ChatSessionRecord) -> ChatSessionRecord:
        local_session = self.memory_service.upsert_chat_session(session)
        if self.supabase_service.is_enabled():
            try:
                self.supabase_service.upsert_chat_session(session)
            except Exception as exc:
                self.logger.warning("Falha ao sincronizar sessao de chat no Supabase: %s", exc)
        return local_session

    def append_chat_messages(self, messages: List[ChatMessageRecord]) -> List[ChatMessageRecord]:
        self.memory_service.append_chat_messages(messages)
        if self.supabase_service.is_enabled():
            try:
                self.supabase_service.insert_chat_messages(messages)
            except Exception as exc:
                self.logger.warning("Falha ao sincronizar mensagens no Supabase: %s", exc)
        return messages

    def _normalize_project(self, project: Dict[str, Any], source: str) -> Dict[str, Any]:
        payload = dict(project)
        payload["source"] = source
        return payload
