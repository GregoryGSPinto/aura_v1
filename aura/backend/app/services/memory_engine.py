"""
Memory Engine — Facade async sobre SQLiteMemoryService.

Adiciona:
1. Tabela conversations (historico resumido)
2. Metodos de facts (usando long_memory com categoria)
3. API async para integracao com agent_service
4. get_context_for_prompt() formatado pro LLM

Reutiliza SQLiteMemoryService para preferences, projects, session, long_memory.
"""

import asyncio
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.sqlite_memory import SQLiteMemoryService

logger = logging.getLogger("aura")

_EXTRA_SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    summary TEXT,
    project_id TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    fact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_facts_project ON facts(project_id);
CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
"""


class MemoryEngine:
    """
    Facade async sobre SQLiteMemoryService + tabelas extras.

    Tres camadas:
    1. Preferences: coisas que Gregory gosta/prefere
    2. Projects: projetos com stack, status, paths
    3. Facts: fatos por projeto (decisoes, next steps, blockers, notas)
    4. Conversations: historico resumido de conversas
    5. Session: contexto da conversa atual (limpa a cada 24h)
    """

    def __init__(self, db_path: str = "data/memory.db"):
        self.db_path = db_path
        self._sqlite: Optional[SQLiteMemoryService] = None

    async def init_db(self) -> None:
        """Inicializa o DB: cria SQLiteMemoryService + tabelas extras."""
        self._sqlite = SQLiteMemoryService(db_path=self.db_path)
        conn = self._sqlite._get_conn()
        try:
            conn.executescript(_EXTRA_SCHEMA)
            conn.commit()
            logger.info("[MemoryEngine] Extra tables initialized (conversations, facts)")
        finally:
            conn.close()

    @property
    def sqlite(self) -> SQLiteMemoryService:
        if self._sqlite is None:
            raise RuntimeError("MemoryEngine not initialized. Call init_db() first.")
        return self._sqlite

    # ── Preferences ──────────────────────────────────────────

    async def set_preference(self, key: str, value: str) -> None:
        self.sqlite.set_preference("general", key, value)

    async def get_preference(self, key: str) -> Optional[str]:
        prefs = self.sqlite.get_preferences()
        for p in prefs:
            if p["key"] == key:
                return p["value"]
        return None

    async def get_all_preferences(self) -> List[Dict[str, Any]]:
        return self.sqlite.get_preferences()

    # ── Projects ─────────────────────────────────────────────

    async def create_project(self, project_id: str, name: str, **kwargs: Any) -> Dict[str, Any]:
        return self.sqlite.create_project(project_id, name, **kwargs)

    async def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        return self.sqlite.get_project(project_id)

    async def list_projects(self) -> List[Dict[str, Any]]:
        return self.sqlite.get_all_projects()

    async def update_project(self, project_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        return self.sqlite.update_project(project_id, **kwargs)

    # ── Facts ────────────────────────────────────────────────

    async def add_fact(
        self,
        project_id: Optional[str],
        fact_type: str,
        content: str,
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        conn = self.sqlite._get_conn()
        try:
            conn.execute(
                "INSERT INTO facts (project_id, fact_type, content, expires_at) VALUES (?, ?, ?, ?)",
                (project_id, fact_type, content, expires_at),
            )
            conn.commit()
            row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            return {"id": row_id, "project_id": project_id, "fact_type": fact_type, "content": content}
        finally:
            conn.close()

    async def get_facts(self, project_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        conn = self.sqlite._get_conn()
        try:
            if project_id:
                rows = conn.execute(
                    "SELECT * FROM facts WHERE project_id = ? AND active = 1 "
                    "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) "
                    "ORDER BY created_at DESC LIMIT ?",
                    (project_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM facts WHERE active = 1 "
                    "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) "
                    "ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    async def deactivate_fact(self, fact_id: int) -> bool:
        conn = self.sqlite._get_conn()
        try:
            cursor = conn.execute("UPDATE facts SET active = 0 WHERE id = ?", (fact_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ── Conversations ────────────────────────────────────────

    async def save_conversation(
        self,
        conversation_id: str,
        summary: str,
        project_id: Optional[str] = None,
    ) -> None:
        conn = self.sqlite._get_conn()
        try:
            existing = conn.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
            if existing:
                conn.execute(
                    "UPDATE conversations SET summary = ?, last_message_at = CURRENT_TIMESTAMP, "
                    "message_count = message_count + 1 WHERE id = ?",
                    (summary, conversation_id),
                )
            else:
                conn.execute(
                    "INSERT INTO conversations (id, summary, project_id, message_count) VALUES (?, ?, ?, 1)",
                    (conversation_id, summary, project_id),
                )
            conn.commit()
        finally:
            conn.close()

    async def get_recent_conversations(self, limit: int = 10) -> List[Dict[str, Any]]:
        conn = self.sqlite._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ── Session ──────────────────────────────────────────────

    async def set_session(self, key: str, value: str, session_id: str = "default") -> None:
        self.sqlite.add_session_memory(session_id, key, value)

    async def get_session(self, key: str, session_id: str = "default") -> Optional[str]:
        ctx = self.sqlite.get_session_context(session_id)
        for item in ctx:
            if item["key"] == key:
                return item["value"]
        return None

    # ── Context for Prompt ───────────────────────────────────

    async def get_context_for_prompt(self, project_id: Optional[str] = None) -> str:
        """Retorna string formatada com contexto relevante para injetar no system prompt."""
        parts: List[str] = []

        # 1. User info from preferences
        prefs = self.sqlite.get_preferences()
        name = "Gregory"
        pref_items = []
        for p in prefs:
            if p["key"] == "name":
                name = p["value"]
            else:
                pref_items.append(f"{p['key']}: {p['value']}")
        parts.append(f"Usuario: {name}")
        if pref_items:
            parts.append(f"Preferencias: {', '.join(pref_items[:8])}")

        # 2. Active project
        if project_id:
            project = self.sqlite.get_project(project_id)
            if project:
                stack = project.get("stack", "")
                if isinstance(stack, list):
                    stack = ", ".join(stack)
                parts.append(f"Projeto ativo: {project['name']} ({stack})")
                if project.get("notes"):
                    parts.append(f"Notas: {project['notes']}")

        # 3. Recent facts
        facts = await self.get_facts(project_id=project_id, limit=10)
        if facts:
            fact_lines = []
            for f in facts[:7]:
                fact_lines.append(f"- [{f['fact_type']}] {f['content'][:150]}")
            parts.append("Fatos recentes:\n" + "\n".join(fact_lines))

        # 4. Recent conversations
        convos = await self.get_recent_conversations(limit=3)
        if convos:
            parts.append(f"Conversas recentes: {len(convos)}")

        return "\n".join(parts) if parts else "Sem contexto disponivel."

    # ── Cleanup ──────────────────────────────────────────────

    async def cleanup(self) -> int:
        """Limpeza diaria: sessions >24h, facts expirados, limita facts a 50/projeto."""
        count = self.sqlite.cleanup_expired()

        conn = self.sqlite._get_conn()
        try:
            # Deactivate expired facts
            c1 = conn.execute(
                "UPDATE facts SET active = 0 WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP AND active = 1"
            )
            count += c1.rowcount

            # Limit facts to 50 per project
            rows = conn.execute(
                "SELECT DISTINCT project_id FROM facts WHERE active = 1 AND project_id IS NOT NULL"
            ).fetchall()
            for row in rows:
                pid = row[0]
                excess = conn.execute(
                    "SELECT id FROM facts WHERE project_id = ? AND active = 1 ORDER BY created_at DESC LIMIT -1 OFFSET 50",
                    (pid,),
                ).fetchall()
                if excess:
                    ids = [r[0] for r in excess]
                    conn.execute(
                        f"UPDATE facts SET active = 0 WHERE id IN ({','.join('?' * len(ids))})",
                        ids,
                    )
                    count += len(ids)

            conn.commit()
        finally:
            conn.close()

        if count > 0:
            logger.info("[MemoryEngine] Cleanup: %d entries cleaned", count)
        return count
