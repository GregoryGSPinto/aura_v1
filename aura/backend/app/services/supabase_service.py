from typing import Any, Dict, List, Optional

import httpx

from app.core.config import Settings
from app.core.exceptions import ExternalServiceError
from app.models.persistence_models import AuditLogEntry, ChatMessageRecord, ChatSessionRecord


class SupabaseService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.supabase_url.rstrip("/")

    def is_enabled(self) -> bool:
        return self.settings.supabase_enabled and self.settings.supabase_configured

    def _rest_url(self, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _auth_url(self, path: str) -> str:
        return f"{self.base_url}/auth/v1/{path.lstrip('/')}"

    def _service_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.settings.supabase_service_role_key,
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _anon_headers(self, token: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.settings.supabase_anon_key,
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _request(self, method: str, url: str, **kwargs):
        try:
            with httpx.Client(timeout=self.settings.http_timeout) as client:
                response = client.request(method, url, **kwargs)
                response.raise_for_status()
                return response
        except Exception as exc:
            raise ExternalServiceError("Falha de comunicação com o Supabase.", details=str(exc)) from exc

    def check_health(self) -> str:
        if not self.is_enabled():
            return "disabled"
        try:
            self._request(
                "GET",
                self._rest_url("aura_settings"),
                headers=self._service_headers(),
                params={"select": "key", "limit": 1},
            )
            return "online"
        except ExternalServiceError:
            return "offline"

    def fetch_projects(self) -> List[Dict[str, Any]]:
        response = self._request(
            "GET",
            self._rest_url("aura_projects"),
            headers=self._service_headers(),
            params={"select": "*", "order": "name.asc"},
        )
        return response.json()

    def upsert_projects(self, projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not projects:
            return []
        response = self._request(
            "POST",
            self._rest_url("aura_projects"),
            headers=self._service_headers(
                {
                    "Prefer": "resolution=merge-duplicates,return=representation",
                }
            ),
            json=projects,
        )
        return response.json()

    def fetch_settings(self) -> Dict[str, Any]:
        response = self._request(
            "GET",
            self._rest_url("aura_settings"),
            headers=self._service_headers(),
            params={"select": "key,value_json"},
        )
        settings = {}
        for item in response.json():
            settings[item["key"]] = item.get("value_json")
        return settings

    def upsert_settings(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        payload = [{"key": key, "value_json": value} for key, value in updates.items()]
        if payload:
            self._request(
                "POST",
                self._rest_url("aura_settings"),
                headers=self._service_headers(
                    {
                        "Prefer": "resolution=merge-duplicates,return=representation",
                    }
                ),
                json=payload,
            )
        return updates

    def insert_audit_log(self, entry: AuditLogEntry) -> AuditLogEntry:
        payload = {
            "log_id": entry.log_id,
            "event_timestamp": entry.timestamp,
            "command": entry.command,
            "status": entry.status,
            "params": entry.params,
            "stdout": entry.stdout,
            "stderr": entry.stderr,
            "actor_id": entry.actor_id,
            "metadata": entry.metadata,
        }
        self._request("POST", self._rest_url("aura_audit_logs"), headers=self._service_headers(), json=payload)
        return entry

    def get_recent_audit_logs(self, limit: int = 40) -> List[Dict[str, Any]]:
        response = self._request(
            "GET",
            self._rest_url("aura_audit_logs"),
            headers=self._service_headers(),
            params={"select": "*", "order": "created_at.desc", "limit": limit},
        )
        return response.json()

    def upsert_chat_session(self, session: ChatSessionRecord) -> ChatSessionRecord:
        payload = {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "project_id": session.project_id,
            "metadata": session.metadata,
        }
        self._request(
            "POST",
            self._rest_url("aura_chat_sessions"),
            headers=self._service_headers(
                {
                    "Prefer": "resolution=merge-duplicates,return=representation",
                }
            ),
            json=payload,
        )
        return session

    def insert_chat_messages(self, messages: List[ChatMessageRecord]) -> List[ChatMessageRecord]:
        payload = [
            {
                "session_id": message.session_id,
                "role": message.role,
                "content": message.content,
                "model": message.model,
                "intent": message.intent,
                "metadata": message.metadata,
            }
            for message in messages
        ]
        if payload:
            self._request("POST", self._rest_url("aura_chat_messages"), headers=self._service_headers(), json=payload)
        return messages

    def get_authenticated_user(self, token: str) -> Dict[str, Any]:
        response = self._request(
            "GET",
            self._auth_url("/user"),
            headers=self._anon_headers(token),
        )
        return response.json()

