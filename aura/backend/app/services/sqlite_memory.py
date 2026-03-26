"""
Sprint 3 — SQLite Memory Service.

Structured memory: preferences, projects, session_memory, long_memory.
Coexists with existing JSON-based MemoryService.
"""

import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")

_SCHEMA_VERSION = 1

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'explicit',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mem_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    stack TEXT,
    status TEXT DEFAULT 'active',
    repo_url TEXT,
    deploy_url TEXT,
    directory TEXT,
    links TEXT,
    last_commands TEXT,
    next_steps TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS long_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    relevance_score REAL DEFAULT 1.0,
    project_slug TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_memory_session ON session_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_long_memory_category ON long_memory(category);
CREATE INDEX IF NOT EXISTS idx_long_memory_project ON long_memory(project_slug);
CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(category);
"""

_SEED_PREFERENCES = [
    ("tools", "package_manager", "pnpm"),
    ("tools", "deploy_platform", "Vercel"),
    ("tools", "git_platform", "GitHub"),
    ("style", "ui_style", "premium, glassmorphism, dark mode"),
    ("style", "code_style", "clean, TypeScript, functional components"),
    ("workflow", "prompt_level", "CTO/senior, direto ao ponto"),
    ("dev", "framework_frontend", "Next.js 15"),
    ("dev", "framework_backend", "FastAPI"),
    ("dev", "ai_local", "Ollama + Qwen"),
    ("personal", "name", "Gregory"),
    ("personal", "role", "Maquinista EFVM + Software Engineer"),
    ("personal", "language", "pt-BR"),
]

_SEED_PROJECTS = [
    {
        "slug": "aura",
        "name": "Aura - Assistente Pessoal AI",
        "description": "Assistente pessoal AI com interface premium, chat inteligente, e agentes autonomos",
        "stack": json.dumps(["Next.js 15", "FastAPI", "Ollama", "Qwen"]),
        "status": "active",
        "directory": "~/Projetos/aura_v1/aura",
        "deploy_url": "https://aura-or9pfmlbm-gregorys-projects-e10ef67b.vercel.app",
    },
    {
        "slug": "black-belt",
        "name": "Black Belt - Plataforma de Streaming BJJ",
        "description": "Plataforma de streaming para Brazilian Jiu-Jitsu",
        "stack": json.dumps([]),
        "status": "active",
        "directory": "~/Projetos/black_belt_v2",
    },
    {
        "slug": "efvm360",
        "name": "EFVM360 - Plataforma Operacional Ferroviaria",
        "description": "Plataforma operacional para a EFVM (aguardando aprovacao Vale)",
        "stack": json.dumps([]),
        "status": "active",
    },
]


class SQLiteMemoryService:
    """SQLite-backed structured memory for preferences, projects, sessions, and long-term memory."""

    def __init__(self, db_path: str = "data/memory.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self) -> None:
        conn = self._get_conn()
        try:
            conn.executescript(_SCHEMA_SQL)

            # Check schema version
            row = conn.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").fetchone()
            if row is None:
                # First run — seed data
                conn.execute("INSERT INTO schema_version (version) VALUES (?)", (_SCHEMA_VERSION,))
                self._seed_preferences(conn)
                self._seed_projects(conn)
                conn.commit()
                logger.info("[SQLiteMemory] Database initialized with seed data (v%d)", _SCHEMA_VERSION)
            else:
                logger.info("[SQLiteMemory] Database loaded (v%d)", row["version"])
        finally:
            conn.close()

    def _seed_preferences(self, conn: sqlite3.Connection) -> None:
        for cat, key, val in _SEED_PREFERENCES:
            conn.execute(
                "INSERT OR IGNORE INTO preferences (category, key, value, source) VALUES (?, ?, ?, 'seed')",
                (cat, key, val),
            )

    def _seed_projects(self, conn: sqlite3.Connection) -> None:
        for proj in _SEED_PROJECTS:
            conn.execute(
                "INSERT OR IGNORE INTO mem_projects (slug, name, description, stack, status, directory, deploy_url) "
                "VALUES (:slug, :name, :description, :stack, :status, :directory, :deploy_url)",
                {
                    "slug": proj["slug"],
                    "name": proj["name"],
                    "description": proj.get("description", ""),
                    "stack": proj.get("stack", "[]"),
                    "status": proj.get("status", "active"),
                    "directory": proj.get("directory", ""),
                    "deploy_url": proj.get("deploy_url", ""),
                },
            )

    # ── Preferences ─────────────────────────────────────────────────

    def get_preferences(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            if category:
                rows = conn.execute("SELECT * FROM preferences WHERE category = ? ORDER BY key", (category,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM preferences ORDER BY category, key").fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def set_preference(self, category: str, key: str, value: str, source: str = "explicit") -> Dict[str, Any]:
        conn = self._get_conn()
        try:
            conn.execute(
                "INSERT INTO preferences (category, key, value, source, updated_at) "
                "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value, source=excluded.source, updated_at=CURRENT_TIMESTAMP",
                (category, key, value, source),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM preferences WHERE key = ?", (key,)).fetchone()
            return dict(row) if row else {"category": category, "key": key, "value": value}
        finally:
            conn.close()

    def delete_preference(self, key: str) -> bool:
        conn = self._get_conn()
        try:
            cursor = conn.execute("DELETE FROM preferences WHERE key = ?", (key,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ── Projects ────────────────────────────────────────────────────

    def get_project(self, slug: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            row = conn.execute("SELECT * FROM mem_projects WHERE slug = ?", (slug,)).fetchone()
            if row:
                d = dict(row)
                for json_field in ("stack", "links", "last_commands", "next_steps"):
                    if d.get(json_field):
                        try:
                            d[json_field] = json.loads(d[json_field])
                        except (json.JSONDecodeError, TypeError):
                            pass
                return d
            return None
        finally:
            conn.close()

    def get_all_projects(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            if status:
                rows = conn.execute("SELECT * FROM mem_projects WHERE status = ? ORDER BY name", (status,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM mem_projects ORDER BY name").fetchall()
            results = []
            for row in rows:
                d = dict(row)
                for json_field in ("stack", "links", "last_commands", "next_steps"):
                    if d.get(json_field):
                        try:
                            d[json_field] = json.loads(d[json_field])
                        except (json.JSONDecodeError, TypeError):
                            pass
                results.append(d)
            return results
        finally:
            conn.close()

    def update_project(self, slug: str, **fields: Any) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            # Serialize JSON fields
            for json_field in ("stack", "links", "last_commands", "next_steps"):
                if json_field in fields and not isinstance(fields[json_field], str):
                    fields[json_field] = json.dumps(fields[json_field], ensure_ascii=False)

            allowed = {"name", "description", "stack", "status", "repo_url", "deploy_url", "directory", "links", "last_commands", "next_steps", "notes"}
            updates = {k: v for k, v in fields.items() if k in allowed}
            if not updates:
                return self.get_project(slug)

            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [slug]
            conn.execute(f"UPDATE mem_projects SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE slug = ?", values)
            conn.commit()
            return self.get_project(slug)
        finally:
            conn.close()

    def create_project(self, slug: str, name: str, **fields: Any) -> Dict[str, Any]:
        conn = self._get_conn()
        try:
            for json_field in ("stack", "links", "last_commands", "next_steps"):
                if json_field in fields and not isinstance(fields[json_field], str):
                    fields[json_field] = json.dumps(fields[json_field], ensure_ascii=False)

            conn.execute(
                "INSERT INTO mem_projects (slug, name, description, stack, status, repo_url, deploy_url, directory, links, notes) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    slug,
                    name,
                    fields.get("description", ""),
                    fields.get("stack", "[]"),
                    fields.get("status", "active"),
                    fields.get("repo_url", ""),
                    fields.get("deploy_url", ""),
                    fields.get("directory", ""),
                    fields.get("links", "{}"),
                    fields.get("notes", ""),
                ),
            )
            conn.commit()
            return self.get_project(slug) or {"slug": slug, "name": name}
        finally:
            conn.close()

    # ── Session Memory ──────────────────────────────────────────────

    def get_session_context(self, session_id: str) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM session_memory WHERE session_id = ? ORDER BY created_at DESC LIMIT 50",
                (session_id,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def add_session_memory(self, session_id: str, key: str, value: str) -> Dict[str, Any]:
        conn = self._get_conn()
        try:
            conn.execute("INSERT INTO session_memory (session_id, key, value) VALUES (?, ?, ?)", (session_id, key, value))
            conn.commit()
            return {"session_id": session_id, "key": key, "value": value}
        finally:
            conn.close()

    # ── Long Memory ─────────────────────────────────────────────────

    def add_long_memory(self, category: str, content: str, project_slug: Optional[str] = None, expires_at: Optional[str] = None) -> Dict[str, Any]:
        conn = self._get_conn()
        try:
            conn.execute(
                "INSERT INTO long_memory (category, content, project_slug, expires_at) VALUES (?, ?, ?, ?)",
                (category, content, project_slug, expires_at),
            )
            conn.commit()
            row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            return {"id": row_id, "category": category, "content": content, "project_slug": project_slug}
        finally:
            conn.close()

    def get_long_memories(self, category: Optional[str] = None, project_slug: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            query = "SELECT * FROM long_memory WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
            params: List[Any] = []
            if category:
                query += " AND category = ?"
                params.append(category)
            if project_slug:
                query += " AND project_slug = ?"
                params.append(project_slug)
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def delete_long_memory(self, memory_id: int) -> bool:
        conn = self._get_conn()
        try:
            cursor = conn.execute("DELETE FROM long_memory WHERE id = ?", (memory_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ── Context Search ──────────────────────────────────────────────

    def get_relevant_context(self, query: str, project_slug: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Simple keyword-based relevance search across all memory types."""
        conn = self._get_conn()
        results: List[Dict[str, Any]] = []
        keywords = [kw.strip() for kw in query.lower().split() if len(kw.strip()) >= 3]
        if not keywords:
            return results

        try:
            # Search preferences
            for kw in keywords[:5]:
                pattern = f"%{kw}%"
                rows = conn.execute(
                    "SELECT 'preference' as type, key as title, value as content, confidence as score FROM preferences WHERE LOWER(key) LIKE ? OR LOWER(value) LIKE ? LIMIT 5",
                    (pattern, pattern),
                ).fetchall()
                results.extend(dict(r) for r in rows)

            # Search long memory
            for kw in keywords[:5]:
                pattern = f"%{kw}%"
                q = "SELECT 'long_memory' as type, category as title, content, relevance_score as score FROM long_memory WHERE LOWER(content) LIKE ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
                params_list: List[Any] = [pattern]
                if project_slug:
                    q += " AND project_slug = ?"
                    params_list.append(project_slug)
                q += " LIMIT 5"
                rows = conn.execute(q, params_list).fetchall()
                results.extend(dict(r) for r in rows)

            # Deduplicate by content
            seen = set()
            unique = []
            for r in results:
                key = r.get("content", "")[:100]
                if key not in seen:
                    seen.add(key)
                    unique.append(r)
            return unique[:limit]
        finally:
            conn.close()

    # ── Cleanup ─────────────────────────────────────────────────────

    def cleanup_expired(self) -> int:
        conn = self._get_conn()
        try:
            # Remove expired long memories
            c1 = conn.execute("DELETE FROM long_memory WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP")
            # Remove sessions older than 24h
            c2 = conn.execute("DELETE FROM session_memory WHERE created_at < datetime('now', '-24 hours')")
            conn.commit()
            total = c1.rowcount + c2.rowcount
            if total > 0:
                logger.info("[SQLiteMemory] Cleanup: removed %d expired entries", total)
            return total
        finally:
            conn.close()

    # ── Context Prompt Builder ──────────────────────────────────────

    def build_context_prompt(self, session_id: str, project_slug: Optional[str] = None) -> str:
        """Build a context block for injection into the LLM system prompt."""
        parts: List[str] = []

        # 1. User preferences (summarized)
        prefs = self.get_preferences()
        if prefs:
            pref_lines = []
            for p in prefs:
                pref_lines.append(f"- {p['key']}: {p['value']}")
            parts.append("### Preferencias do Gregory\n" + "\n".join(pref_lines))

        # 2. Active project context
        if project_slug:
            project = self.get_project(project_slug)
            if project:
                stack = project.get("stack", [])
                if isinstance(stack, str):
                    try:
                        stack = json.loads(stack)
                    except (json.JSONDecodeError, TypeError):
                        stack = []
                stack_str = ", ".join(stack) if stack else "N/A"
                proj_info = (
                    f"### Projeto Ativo: {project['name']}\n"
                    f"- Slug: {project['slug']}\n"
                    f"- Stack: {stack_str}\n"
                    f"- Status: {project.get('status', 'unknown')}\n"
                    f"- Diretorio: {project.get('directory', 'N/A')}"
                )
                if project.get("notes"):
                    proj_info += f"\n- Notas: {project['notes']}"
                next_steps = project.get("next_steps")
                if next_steps:
                    if isinstance(next_steps, str):
                        try:
                            next_steps = json.loads(next_steps)
                        except (json.JSONDecodeError, TypeError):
                            next_steps = []
                    if next_steps:
                        proj_info += "\n- Proximos passos: " + "; ".join(str(s) for s in next_steps[:5])
                parts.append(proj_info)

        # 3. Session context
        session_ctx = self.get_session_context(session_id)
        if session_ctx:
            ctx_lines = [f"- {s['key']}: {s['value']}" for s in session_ctx[:10]]
            parts.append("### Contexto desta Sessao\n" + "\n".join(ctx_lines))

        # 4. Recent long memories
        long_mems = self.get_long_memories(project_slug=project_slug, limit=5)
        if long_mems:
            mem_lines = [f"- [{m['category']}] {m['content'][:200]}" for m in long_mems]
            parts.append("### Memorias Relevantes\n" + "\n".join(mem_lines))

        if not parts:
            return ""

        return "## Contexto Atual (Memoria da Aura)\n\n" + "\n\n".join(parts)
