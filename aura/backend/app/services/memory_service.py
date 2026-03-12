import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.job_models import JobLogEntry, JobRecord
from app.models.persistence_models import AuditLogEntry, ChatMessageRecord, ChatSessionRecord
from app.utils.helpers import iso_now


class MemoryService:
    def __init__(
        self,
        settings_file: str,
        projects_file: str,
        audit_json_file: str,
        chat_sessions_file: str,
        chat_messages_file: str,
        companion_memory_file: str,
        jobs_file: str,
        job_logs_file: str,
    ):
        self.settings_path = Path(settings_file)
        self.projects_path = Path(projects_file)
        self.audit_json_path = Path(audit_json_file)
        self.chat_sessions_path = Path(chat_sessions_file)
        self.chat_messages_path = Path(chat_messages_file)
        self.companion_memory_path = Path(companion_memory_file)
        self.jobs_path = Path(jobs_file)
        self.job_logs_path = Path(job_logs_file)

    def _read_json(self, path: Path, fallback: Any):
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(fallback, indent=2), encoding="utf-8")
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def get_projects(self):
        return self._read_json(self.projects_path, [])

    def save_projects(self, projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        self._write_json(self.projects_path, projects)
        return projects

    def get_settings(self):
        return self._read_json(self.settings_path, {})

    def update_settings(self, updates: dict) -> dict:
        settings = self.get_settings()
        settings.update(updates)
        settings["last_updated"] = iso_now()
        self._write_json(self.settings_path, settings)
        return settings

    def append_audit_log(self, entry: AuditLogEntry) -> AuditLogEntry:
        logs = self._read_json(self.audit_json_path, [])
        logs.append(entry.model_dump())
        self._write_json(self.audit_json_path, logs)
        return entry

    def get_recent_audit_logs(self, limit: int = 40) -> List[Dict[str, Any]]:
        logs = self._read_json(self.audit_json_path, [])
        return logs[-limit:]

    def upsert_chat_session(self, session: ChatSessionRecord) -> ChatSessionRecord:
        sessions = self._read_json(self.chat_sessions_path, [])
        payload = session.model_dump()
        for index, item in enumerate(sessions):
            if item.get("session_id") == session.session_id:
                merged = dict(item)
                merged.update(payload)
                sessions[index] = merged
                self._write_json(self.chat_sessions_path, sessions)
                return ChatSessionRecord(**merged)
        sessions.append(payload)
        self._write_json(self.chat_sessions_path, sessions)
        return session

    def append_chat_messages(self, messages: List[ChatMessageRecord]) -> List[ChatMessageRecord]:
        existing = self._read_json(self.chat_messages_path, [])
        existing.extend(message.model_dump() for message in messages)
        self._write_json(self.chat_messages_path, existing)
        return messages

    def get_chat_messages(self, session_id: Optional[str] = None, limit: int = 80) -> List[Dict[str, Any]]:
        messages = self._read_json(self.chat_messages_path, [])
        if session_id:
            messages = [item for item in messages if item.get("session_id") == session_id]
        return messages[-limit:]

    def get_chat_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        sessions = self._read_json(self.chat_sessions_path, [])
        return sessions[-limit:]

    def get_companion_memory(self) -> Dict[str, Any]:
        fallback = {
            "profile": {
                "user_label": "Gregory",
                "mode": "founder",
                "communication_style": "executivo, direto e orientado a operacao",
                "decision_style": "rapido com trade-offs claros",
                "updated_at": None,
            },
            "preferences": [],
            "project_memory": [],
            "operational_memory": [],
            "recent_context": [],
        }
        return self._read_json(self.companion_memory_path, fallback)

    def save_companion_memory(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._write_json(self.companion_memory_path, payload)
        return payload

    def remember_companion_item(self, bucket: str, item: Dict[str, Any], limit: int = 24) -> Dict[str, Any]:
        memory = self.get_companion_memory()
        items = list(memory.get(bucket, []))
        dedupe_key = item.get("dedupe_key") or item.get("title") or item.get("content")
        items = [existing for existing in items if (existing.get("dedupe_key") or existing.get("title") or existing.get("content")) != dedupe_key]
        items.insert(0, item)
        memory[bucket] = items[:limit]
        memory["profile"] = {**memory.get("profile", {}), "updated_at": iso_now()}
        self.save_companion_memory(memory)
        return item

    def list_jobs(self) -> List[Dict[str, Any]]:
        return self._read_json(self.jobs_path, [])

    def save_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        self._write_json(self.jobs_path, jobs)
        return jobs

    def upsert_job(self, job: JobRecord) -> JobRecord:
        jobs = self._read_json(self.jobs_path, [])
        payload = job.model_dump()
        for index, item in enumerate(jobs):
            if item.get("id") == job.id:
                jobs[index] = payload
                self._write_json(self.jobs_path, jobs)
                return job
        jobs.append(payload)
        self._write_json(self.jobs_path, jobs)
        return job

    def append_job_log(self, entry: JobLogEntry) -> JobLogEntry:
        logs = self._read_json(self.job_logs_path, [])
        logs.append(entry.model_dump())
        self._write_json(self.job_logs_path, logs)
        return entry

    def list_job_logs(self, job_id: str) -> List[Dict[str, Any]]:
        logs = self._read_json(self.job_logs_path, [])
        return [log for log in logs if log.get("job_id") == job_id]
