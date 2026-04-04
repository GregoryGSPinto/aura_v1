"""
GTM Strategy Service — SQLite persistence for GTM Strategy data.

Mirrors the Supabase schema from gtm-strategy/src/lib/supabase-schema.sql
adapted for SQLite. Provides CRUD + analytics for all GTM collections.
"""

import sqlite3
import uuid
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional


_GTM_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS gtm_leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    product TEXT NOT NULL CHECK (product IN ('bb', 'pw')),
    "column" TEXT NOT NULL DEFAULT 'cold' CHECK ("column" IN ('cold', 'contato', 'demo', 'piloto', 'pagante')),
    city TEXT DEFAULT '',
    instagram TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    last_contact TEXT,
    interactions TEXT DEFAULT '[]',
    stage_entered_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gtm_scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    product TEXT NOT NULL CHECK (product IN ('blackbelt', 'primalwod', 'ambos')),
    stage TEXT NOT NULL,
    channel TEXT NOT NULL,
    text TEXT NOT NULL,
    custom INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gtm_content (
    id TEXT PRIMARY KEY,
    product TEXT NOT NULL CHECK (product IN ('blackbelt', 'primalwod', 'ambos')),
    type TEXT NOT NULL CHECK (type IN ('reel', 'story', 'carrossel', 'post', 'tiktok', 'youtube')),
    title TEXT NOT NULL,
    caption TEXT DEFAULT '',
    scheduled_date TEXT,
    status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'rascunho', 'agendado', 'publicado')),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gtm_daily_metrics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL DEFAULT (date('now')),
    product TEXT NOT NULL CHECK (product IN ('blackbelt', 'primalwod')),
    dms_sent INTEGER DEFAULT 0,
    dms_replied INTEGER DEFAULT 0,
    demos_scheduled INTEGER DEFAULT 0,
    demos_done INTEGER DEFAULT 0,
    trials_started INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gtm_tasks (
    id TEXT PRIMARY KEY,
    completed INTEGER DEFAULT 0,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS gtm_activity (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('lead', 'script', 'content', 'metric')),
    description TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gtm_outreach_vars (
    id TEXT PRIMARY KEY,
    meu_nome TEXT DEFAULT 'Gregory',
    meu_produto_bb TEXT DEFAULT 'Blackbelt',
    meu_produto_pw TEXT DEFAULT 'PrimalWOD',
    resultado_case TEXT DEFAULT 'reduziu 40%% do tempo de gestão',
    num_professores TEXT DEFAULT '10',
    num_usuarios TEXT DEFAULT '50',
    beneficio_indicacao TEXT DEFAULT '1 mês grátis'
);

CREATE TABLE IF NOT EXISTS gtm_script_usage (
    id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gtm_capture_goals (
    id TEXT PRIMARY KEY,
    dms_per_day INTEGER DEFAULT 5,
    demos_per_week INTEGER DEFAULT 3,
    trials_per_month INTEGER DEFAULT 5,
    conversions_per_month INTEGER DEFAULT 2
);

CREATE INDEX IF NOT EXISTS idx_gtm_leads_product ON gtm_leads(product);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_column ON gtm_leads("column");
CREATE INDEX IF NOT EXISTS idx_gtm_content_status ON gtm_content(status);
CREATE INDEX IF NOT EXISTS idx_gtm_content_scheduled ON gtm_content(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_gtm_metrics_date ON gtm_daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_gtm_activity_ts ON gtm_activity(timestamp DESC);
"""

# Map frontend collection names → SQLite table names
_TABLE_MAP: Dict[str, str] = {
    "leads": "gtm_leads",
    "scripts": "gtm_scripts",
    "content": "gtm_content",
    "daily_metrics": "gtm_daily_metrics",
    "tasks": "gtm_tasks",
    "activity": "gtm_activity",
    "outreach_vars": "gtm_outreach_vars",
    "script_usage": "gtm_script_usage",
    "capture_goals": "gtm_capture_goals",
}

VALID_COLLECTIONS = set(_TABLE_MAP.keys())


class GTMService:
    """SQLite-backed CRUD + analytics for GTM Strategy collections."""

    def __init__(self, db_path: str = "data/gtm.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    # ── connection ──────────────────────────────────────────

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self) -> None:
        conn = self._get_conn()
        try:
            conn.executescript(_GTM_SCHEMA_SQL)
            conn.commit()
        finally:
            conn.close()

    def _table(self, collection: str) -> str:
        t = _TABLE_MAP.get(collection)
        if not t:
            raise ValueError(f"Unknown collection: {collection}")
        return t

    # ── CRUD ────────────────────────────────────────────────

    def list_items(
        self, collection: str, filters: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        table = self._table(collection)
        conn = self._get_conn()
        try:
            sql = f'SELECT * FROM "{table}"'
            params: list = []
            if filters:
                clauses = []
                for k, v in filters.items():
                    clauses.append(f'"{k}" = ?')
                    params.append(v)
                sql += " WHERE " + " AND ".join(clauses)
            sql += " ORDER BY rowid DESC"
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_item(self, collection: str, item_id: str) -> Optional[Dict[str, Any]]:
        table = self._table(collection)
        conn = self._get_conn()
        try:
            row = conn.execute(
                f'SELECT * FROM "{table}" WHERE id = ?', (item_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def create_item(self, collection: str, data: Dict[str, Any]) -> Dict[str, Any]:
        table = self._table(collection)
        if "id" not in data or not data["id"]:
            data["id"] = str(uuid.uuid4())
        conn = self._get_conn()
        try:
            cols = ", ".join(f'"{k}"' for k in data.keys())
            placeholders = ", ".join("?" for _ in data)
            conn.execute(
                f'INSERT OR REPLACE INTO "{table}" ({cols}) VALUES ({placeholders})',
                list(data.values()),
            )
            conn.commit()
            row = conn.execute(
                f'SELECT * FROM "{table}" WHERE id = ?', (data["id"],)
            ).fetchone()
            return dict(row) if row else data
        finally:
            conn.close()

    def update_item(
        self, collection: str, item_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        table = self._table(collection)
        data.pop("id", None)
        if not data:
            return self.get_item(collection, item_id)
        conn = self._get_conn()
        try:
            sets = ", ".join(f'"{k}" = ?' for k in data.keys())
            params = list(data.values()) + [item_id]
            conn.execute(
                f'UPDATE "{table}" SET {sets} WHERE id = ?', params
            )
            conn.commit()
            row = conn.execute(
                f'SELECT * FROM "{table}" WHERE id = ?', (item_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_item(self, collection: str, item_id: str) -> bool:
        table = self._table(collection)
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                f'DELETE FROM "{table}" WHERE id = ?', (item_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ── Analytics / Insights ────────────────────────────────

    def get_pipeline_stats(self) -> Dict[str, Any]:
        conn = self._get_conn()
        try:
            total = conn.execute("SELECT COUNT(*) FROM gtm_leads").fetchone()[0]
            columns = {}
            for row in conn.execute(
                'SELECT "column", COUNT(*) as cnt FROM gtm_leads GROUP BY "column"'
            ).fetchall():
                columns[row["column"]] = row["cnt"]
            paying = columns.get("pagante", 0)
            conversion_rate = round((paying / total) * 100, 1) if total > 0 else 0
            return {
                "total": total,
                "by_column": columns,
                "paying": paying,
                "conversion_rate": conversion_rate,
            }
        finally:
            conn.close()

    def get_stale_leads(self, days: int = 3) -> List[Dict[str, Any]]:
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        conn = self._get_conn()
        try:
            rows = conn.execute(
                'SELECT * FROM gtm_leads WHERE "column" != \'pagante\' AND last_contact < ?',
                (cutoff,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_metrics_summary(self, days: int = 7) -> Dict[str, Any]:
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM gtm_daily_metrics WHERE date >= ?", (cutoff,)
            ).fetchall()
            metrics = [dict(r) for r in rows]
            total = lambda field: sum(m.get(field, 0) for m in metrics)
            dms = total("dms_sent")
            replied = total("dms_replied")
            return {
                "period_days": days,
                "records": len(metrics),
                "dms_sent": dms,
                "dms_replied": replied,
                "reply_rate": round((replied / dms) * 100, 1) if dms > 0 else 0,
                "demos_scheduled": total("demos_scheduled"),
                "demos_done": total("demos_done"),
                "trials_started": total("trials_started"),
                "conversions": total("conversions"),
            }
        finally:
            conn.close()

    def get_streak(self) -> int:
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT DISTINCT date FROM gtm_daily_metrics ORDER BY date DESC"
            ).fetchall()
            dates = {r["date"] for r in rows}
            streak = 0
            d = date.today()
            for _ in range(365):
                if d.isoformat() in dates:
                    streak += 1
                else:
                    break
                d -= timedelta(days=1)
            return streak
        finally:
            conn.close()

    def get_daily_briefing(self) -> Dict[str, Any]:
        pipeline = self.get_pipeline_stats()
        stale = self.get_stale_leads(3)
        last7 = self.get_metrics_summary(7)
        last30 = self.get_metrics_summary(30)
        streak = self.get_streak()

        # Capture goals
        goals = self.get_item("capture_goals", "goals")
        goals_data = goals if goals else {
            "dms_per_day": 5, "demos_per_week": 3,
            "trials_per_month": 5, "conversions_per_month": 2,
        }

        return {
            "date": date.today().isoformat(),
            "pipeline": pipeline,
            "stale_leads_count": len(stale),
            "stale_leads": [{"id": l["id"], "name": l["name"], "last_contact": l["last_contact"]} for l in stale[:5]],
            "metrics_7d": last7,
            "metrics_30d": last30,
            "streak": streak,
            "goals": goals_data,
        }
