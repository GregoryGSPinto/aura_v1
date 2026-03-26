"""
Sprint 11 — Safety Layer.

Permission checking, audit trail, approval queue, and rollback registry.
"""

import json
import logging
import sqlite3
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Permission Levels ───────────────────────────────────────────

PERMISSION_MAP = {
    # Terminal
    "terminal.execute": "confirm",
    "terminal.status": "free",
    "terminal.list_directory": "free",
    # Files
    "filesystem.read_file": "free",
    "filesystem.list_directory": "free",
    "filesystem.find_files": "free",
    "filesystem.search_text": "free",
    "filesystem.write_file": "confirm",
    "filesystem.delete_file": "critical",
    "filesystem.move_file": "confirm",
    # Git
    "git.status": "free",
    "git.log": "free",
    "git.diff": "free",
    "git.branch": "free",
    "git.add": "confirm",
    "git.commit": "confirm",
    "git.push": "confirm",
    "git.pull": "confirm",
    # GitHub
    "github.list_repos": "free",
    "github.get_repo": "free",
    "github.create_repo": "confirm",
    "github.create_branch": "confirm",
    "github.create_issue": "confirm",
    "github.create_pull_request": "confirm",
    # Vercel
    "vercel.list_projects": "free",
    "vercel.get_project": "free",
    "vercel.create_project": "confirm",
    "vercel.trigger_deploy": "confirm",
    "vercel.set_env_vars": "confirm",
    # Claude
    "claude.execute": "confirm",
    "claude.create_mission": "confirm",
    # Email
    "email.get_unread": "free",
    "email.get_thread": "free",
    "email.search": "free",
    "email.draft_reply": "notice",
    "email.send": "confirm",
    "email.create_draft": "notice",
    # Calendar
    "calendar.get_today": "free",
    "calendar.get_week": "free",
    "calendar.create_event": "confirm",
    "calendar.reschedule": "confirm",
    # Browser
    "browser.fetch_url": "free",
    "browser.check_url": "free",
    "browser.open_url": "notice",
    # System
    "system.summary": "free",
    "system.metrics": "free",
    # Docs
    "doc.read_doc": "free",
    "doc.search_in_doc": "free",
    # Missions
    "missions.create": "free",
    "missions.execute": "confirm",
    "missions.cancel": "confirm",
}


class SafetyService:
    """Permission checking and enforcement."""

    def check_permission(self, action: str) -> str:
        """Returns permission level for an action."""
        return PERMISSION_MAP.get(action, "notice")

    def is_allowed(self, action: str, auto_approve_below: str = "confirm") -> bool:
        level = self.check_permission(action)
        hierarchy = {"free": 0, "notice": 1, "confirm": 2, "critical": 3}
        return hierarchy.get(level, 2) < hierarchy.get(auto_approve_below, 2)

    def requires_approval(self, action: str) -> bool:
        return self.check_permission(action) in ("confirm", "critical")


# ── Audit Service ───────────────────────────────────────────────


class AuditService:
    """Comprehensive action logging to SQLite."""

    _SCHEMA = """
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp REAL NOT NULL,
        action TEXT NOT NULL,
        permission_level TEXT,
        tool TEXT,
        params TEXT,
        result_status TEXT,
        result_detail TEXT,
        user_approved INTEGER DEFAULT 0,
        session_id TEXT,
        mission_id TEXT,
        duration_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    """

    def __init__(self, db_path: str = "data/memory.db"):
        self.db_path = db_path
        conn = sqlite3.connect(db_path)
        conn.executescript(self._SCHEMA)
        conn.close()

    def log_action(
        self,
        action: str,
        tool: str = "",
        params: Optional[Dict[str, Any]] = None,
        result_status: str = "success",
        result_detail: str = "",
        permission_level: str = "free",
        user_approved: bool = False,
        session_id: str = "",
        mission_id: str = "",
        duration_ms: int = 0,
    ) -> str:
        entry_id = str(uuid.uuid4())
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute(
                "INSERT INTO audit_log (id, timestamp, action, permission_level, tool, params, result_status, result_detail, user_approved, session_id, mission_id, duration_ms) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (entry_id, time.time(), action, permission_level, tool,
                 json.dumps(params or {}, ensure_ascii=False), result_status, result_detail[:2000],
                 1 if user_approved else 0, session_id, mission_id, duration_ms),
            )
            conn.commit()
        finally:
            conn.close()
        return entry_id

    def get_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_dangerous(self, limit: int = 20) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE permission_level IN ('confirm', 'critical') ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_summary(self) -> Dict[str, Any]:
        conn = sqlite3.connect(self.db_path)
        try:
            total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
            today = conn.execute("SELECT COUNT(*) FROM audit_log WHERE timestamp > ?", (time.time() - 86400,)).fetchone()[0]
            dangerous = conn.execute("SELECT COUNT(*) FROM audit_log WHERE permission_level IN ('confirm', 'critical')").fetchone()[0]
            failed = conn.execute("SELECT COUNT(*) FROM audit_log WHERE result_status = 'failed'").fetchone()[0]
            return {"total": total, "today": today, "dangerous": dangerous, "failed": failed}
        finally:
            conn.close()


# ── Approval Queue ──────────────────────────────────────────────


class ApprovalQueue:
    """Manage pending approval requests."""

    def __init__(self):
        self.pending: Dict[str, Dict[str, Any]] = {}

    def request_approval(self, action: str, tool: str, params: Dict[str, Any], reason: str = "") -> str:
        req_id = str(uuid.uuid4())
        self.pending[req_id] = {
            "id": req_id,
            "action": action,
            "tool": tool,
            "params": params,
            "reason": reason,
            "requested_at": time.time(),
            "status": "pending",
        }
        return req_id

    def approve(self, request_id: str) -> bool:
        if request_id in self.pending:
            self.pending[request_id]["status"] = "approved"
            return True
        return False

    def reject(self, request_id: str) -> bool:
        if request_id in self.pending:
            self.pending[request_id]["status"] = "rejected"
            return True
        return False

    def get_pending(self) -> List[Dict[str, Any]]:
        return [r for r in self.pending.values() if r["status"] == "pending"]

    def cleanup(self, max_age: int = 3600) -> int:
        cutoff = time.time() - max_age
        expired = [k for k, v in self.pending.items() if v["requested_at"] < cutoff]
        for k in expired:
            del self.pending[k]
        return len(expired)


# ── Rollback Registry ───────────────────────────────────────────


class RollbackRegistry:
    """Track undoable actions for rollback capability."""

    def __init__(self):
        self.entries: deque = deque(maxlen=50)

    def register(self, action_id: str, rollback_command: str, description: str, expires_in: int = 3600) -> None:
        self.entries.append({
            "action_id": action_id,
            "rollback_command": rollback_command,
            "description": description,
            "registered_at": time.time(),
            "expires_at": time.time() + expires_in,
            "executed": False,
        })

    def get_rollbackable(self) -> List[Dict[str, Any]]:
        now = time.time()
        return [e for e in self.entries if not e["executed"] and e["expires_at"] > now]

    def rollback(self, action_id: str) -> Optional[str]:
        for entry in self.entries:
            if entry["action_id"] == action_id and not entry["executed"]:
                entry["executed"] = True
                return entry["rollback_command"]
        return None
