"""
Sprint 7 — Mission Engine V1.

Structured mission planning, execution, and tracking with step-by-step flow.
"""

from __future__ import annotations

import json
import logging
import re
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Enums ───────────────────────────────────────────────────────


class MissionStatus(Enum):
    PLANNING = "planning"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    BLOCKED = "blocked"
    NEEDS_INPUT = "needs_input"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    NEEDS_APPROVAL = "needs_approval"


# ── Models ──────────────────────────────────────────────────────


@dataclass
class MissionStep:
    id: str
    order: int
    description: str
    tool: str
    params: Dict[str, Any]
    status: StepStatus = StepStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    depends_on: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "order": self.order,
            "description": self.description,
            "tool": self.tool,
            "params": self.params,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "depends_on": self.depends_on,
            "duration_s": round(self.finished_at - self.started_at, 1) if self.finished_at and self.started_at else None,
        }


@dataclass
class Mission:
    id: str
    objective: str
    project_slug: Optional[str] = None
    status: MissionStatus = MissionStatus.PLANNING
    steps: List[MissionStep] = field(default_factory=list)
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    summary: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        completed = sum(1 for s in self.steps if s.status == StepStatus.SUCCESS)
        return {
            "id": self.id,
            "objective": self.objective,
            "project_slug": self.project_slug,
            "status": self.status.value,
            "steps": [s.to_dict() for s in self.steps],
            "artifacts": self.artifacts,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "summary": self.summary,
            "error": self.error,
            "total_steps": len(self.steps),
            "completed_steps": completed,
            "progress_percent": int((completed / len(self.steps)) * 100) if self.steps else 0,
            "duration_s": round(self.finished_at - self.started_at, 1) if self.finished_at and self.started_at else None,
        }


# ── Mission Planner ─────────────────────────────────────────────


class MissionPlanner:
    """Decomposes objectives into executable steps using the LLM."""

    def __init__(self, ollama_service=None):
        self.ollama = ollama_service

    async def plan(self, objective: str, project_slug: Optional[str] = None) -> Mission:
        mission = Mission(
            id=str(uuid.uuid4()),
            objective=objective,
            project_slug=project_slug,
        )

        if self.ollama:
            try:
                steps = await self._plan_with_llm(objective, project_slug)
                mission.steps = steps
                mission.status = MissionStatus.QUEUED
                return mission
            except Exception as exc:
                logger.warning("[MissionPlanner] LLM planning failed: %s, using fallback", exc)

        # Fallback: single step
        mission.steps = [
            MissionStep(
                id=str(uuid.uuid4()),
                order=1,
                description=objective,
                tool="claude_code",
                params={"objective": objective, "project_slug": project_slug or ""},
            )
        ]
        mission.status = MissionStatus.QUEUED
        return mission

    async def _plan_with_llm(self, objective: str, project_slug: Optional[str]) -> List[MissionStep]:
        prompt = (
            "Voce e o planejador de missoes da Aura. Decomponha o objetivo em etapas executaveis.\n\n"
            "Ferramentas disponiveis:\n"
            "- terminal: executar comandos shell\n"
            "- filesystem: ler/escrever arquivos\n"
            "- git: operacoes git (status, add, commit, push)\n"
            "- github: operacoes GitHub API (create_repo, create_branch, create_issue, create_pr)\n"
            "- vercel: operacoes Vercel API (create_project, deploy, set_env)\n"
            "- claude_code: delegar tarefa de desenvolvimento ao Claude Code\n"
            "- browser: acessar URLs\n"
            "- deploy_orchestrator: fluxo completo de deploy\n\n"
            f"Projeto: {project_slug or 'nao especificado'}\n"
            f"Objetivo: {objective}\n\n"
            'Responda APENAS com JSON: {"steps": [{"order": 1, "description": "...", "tool": "...", "params": {...}, "depends_on": []}]}'
        )
        response_text, _ = await self.ollama.generate_response(prompt, [], think=False)
        return self._parse_steps(response_text)

    def _parse_steps(self, response: str) -> List[MissionStep]:
        # Try to extract JSON
        json_match = re.search(r'\{[\s\S]*"steps"[\s\S]*\}', response)
        if not json_match:
            raise ValueError("No JSON found in LLM response")

        data = json.loads(json_match.group())
        raw_steps = data.get("steps", [])
        steps = []
        for s in raw_steps:
            steps.append(MissionStep(
                id=str(uuid.uuid4()),
                order=s.get("order", len(steps) + 1),
                description=s.get("description", ""),
                tool=s.get("tool", "terminal"),
                params=s.get("params", {}),
                depends_on=s.get("depends_on", []),
            ))
        return steps


# ── Mission Executor ─────────────────────────────────────────────


class MissionExecutor:
    """Executes missions step by step."""

    def __init__(self, tool_registry=None, claude_bridge=None, sqlite_memory=None):
        self.tools = tool_registry
        self.claude = claude_bridge
        self.memory = sqlite_memory

    async def execute(self, mission: Mission) -> Mission:
        mission.status = MissionStatus.RUNNING
        mission.started_at = time.time()

        await self._emit_progress(mission)

        sorted_steps = sorted(mission.steps, key=lambda s: s.order)
        for step in sorted_steps:
            # Check dependencies
            if step.depends_on:
                deps_met = all(
                    any(s.id == dep and s.status == StepStatus.SUCCESS for s in mission.steps)
                    for dep in step.depends_on
                )
                if not deps_met:
                    step.status = StepStatus.SKIPPED
                    step.error = "Dependency not met"
                    continue

            step.status = StepStatus.RUNNING
            step.started_at = time.time()
            await self._emit_progress(mission)

            try:
                result = await self._execute_step(step)
                step.result = result
                step.status = StepStatus.SUCCESS
            except Exception as exc:
                step.error = str(exc)
                step.status = StepStatus.FAILED
                logger.warning("[MissionExecutor] Step %s failed: %s", step.id[:8], exc)
                # Don't stop entire mission on one step failure
            finally:
                step.finished_at = time.time()

            await self._emit_progress(mission)

        # Determine final status
        failed_steps = [s for s in mission.steps if s.status == StepStatus.FAILED]
        success_steps = [s for s in mission.steps if s.status == StepStatus.SUCCESS]

        if len(success_steps) == len(mission.steps):
            mission.status = MissionStatus.COMPLETED
            mission.summary = f"Missao concluida: {len(success_steps)} etapas executadas com sucesso."
        elif failed_steps:
            mission.status = MissionStatus.FAILED if len(failed_steps) == len(mission.steps) else MissionStatus.COMPLETED
            mission.error = f"{len(failed_steps)} etapa(s) falharam"
            mission.summary = f"{len(success_steps)}/{len(mission.steps)} etapas concluidas."
        else:
            mission.status = MissionStatus.COMPLETED

        mission.finished_at = time.time()

        # Save to long memory
        if self.memory and mission.status == MissionStatus.COMPLETED:
            try:
                self.memory.add_long_memory(
                    category="task_result",
                    content=f"Missao: {mission.objective} — {mission.summary}",
                    project_slug=mission.project_slug,
                )
            except Exception:
                pass

        await self._emit_progress(mission)
        return mission

    async def _execute_step(self, step: MissionStep) -> Dict[str, Any]:
        tool_name = step.tool
        params = step.params

        # Claude Code special handling
        if tool_name == "claude_code" and self.claude:
            cm = await self.claude.create_mission(
                objective=params.get("objective", step.description),
                project_slug=params.get("project_slug", ""),
                working_dir=params.get("working_dir", ""),
            )
            result = await self.claude.execute_mission(cm.id)
            return result.to_dict()

        # Use tool registry
        if self.tools:
            # Map tool name to registry format
            method = params.pop("operation", params.pop("method", "execute"))
            full_name = f"{tool_name}.{method}"
            result = await self.tools.execute(full_name, params)
            return result.to_dict()

        return {"status": "skipped", "reason": "No executor available"}

    async def pause(self, mission: Mission) -> Mission:
        if mission.status == MissionStatus.RUNNING:
            mission.status = MissionStatus.PAUSED
        return mission

    async def resume(self, mission: Mission) -> Mission:
        if mission.status == MissionStatus.PAUSED:
            mission.status = MissionStatus.RUNNING
            return await self.execute(mission)
        return mission

    async def cancel(self, mission: Mission) -> Mission:
        mission.status = MissionStatus.CANCELLED
        mission.finished_at = time.time()
        return mission

    async def approve_step(self, mission: Mission, step_id: str) -> Mission:
        for step in mission.steps:
            if step.id == step_id and step.status == StepStatus.NEEDS_APPROVAL:
                step.status = StepStatus.PENDING
        return mission

    async def _emit_progress(self, mission: Mission) -> None:
        try:
            from app.services.websocket_manager import ws_manager
            completed = sum(1 for s in mission.steps if s.status == StepStatus.SUCCESS)
            event = {
                "type": "mission.progress",
                "mission_id": mission.id,
                "status": mission.status.value,
                "objective": mission.objective,
                "total_steps": len(mission.steps),
                "completed_steps": completed,
                "progress_percent": int((completed / len(mission.steps)) * 100) if mission.steps else 0,
            }
            await ws_manager.broadcast(event)
        except Exception:
            pass


# ── Mission Store ────────────────────────────────────────────────


class MissionStore:
    """SQLite-backed mission persistence."""

    _SCHEMA = """
    CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        project_slug TEXT,
        status TEXT NOT NULL DEFAULT 'planning',
        steps_json TEXT DEFAULT '[]',
        artifacts_json TEXT DEFAULT '[]',
        summary TEXT,
        error TEXT,
        created_at REAL,
        started_at REAL,
        finished_at REAL
    );
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
    CREATE INDEX IF NOT EXISTS idx_missions_project ON missions(project_slug);
    """

    def __init__(self, db_path: str = "data/memory.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.executescript(self._SCHEMA)
        conn.close()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def save(self, mission: Mission) -> None:
        conn = self._get_conn()
        try:
            steps_json = json.dumps([s.to_dict() for s in mission.steps], ensure_ascii=False)
            artifacts_json = json.dumps(mission.artifacts, ensure_ascii=False)
            conn.execute(
                "INSERT OR REPLACE INTO missions (id, objective, project_slug, status, steps_json, artifacts_json, summary, error, created_at, started_at, finished_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (mission.id, mission.objective, mission.project_slug, mission.status.value,
                 steps_json, artifacts_json, mission.summary, mission.error,
                 mission.created_at, mission.started_at, mission.finished_at),
            )
            conn.commit()
        finally:
            conn.close()

    def get(self, mission_id: str) -> Optional[Mission]:
        conn = self._get_conn()
        try:
            row = conn.execute("SELECT * FROM missions WHERE id = ?", (mission_id,)).fetchone()
            if not row:
                return None
            return self._row_to_mission(dict(row))
        finally:
            conn.close()

    def list_missions(self, project_slug: Optional[str] = None, status: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            query = "SELECT * FROM missions WHERE 1=1"
            params: List[Any] = []
            if project_slug:
                query += " AND project_slug = ?"
                params.append(project_slug)
            if status:
                query += " AND status = ?"
                params.append(status)
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            rows = conn.execute(query, params).fetchall()
            missions = []
            for row in rows:
                m = self._row_to_mission(dict(row))
                if m:
                    missions.append(m.to_dict())
            return missions
        finally:
            conn.close()

    def _row_to_mission(self, row: Dict[str, Any]) -> Optional[Mission]:
        try:
            steps_data = json.loads(row.get("steps_json", "[]"))
            steps = []
            for s in steps_data:
                steps.append(MissionStep(
                    id=s.get("id", str(uuid.uuid4())),
                    order=s.get("order", 0),
                    description=s.get("description", ""),
                    tool=s.get("tool", ""),
                    params=s.get("params", {}),
                    status=StepStatus(s.get("status", "pending")),
                    result=s.get("result"),
                    error=s.get("error"),
                    started_at=s.get("started_at"),
                    finished_at=s.get("finished_at"),
                    depends_on=s.get("depends_on", []),
                ))
            artifacts = json.loads(row.get("artifacts_json", "[]"))
            return Mission(
                id=row["id"],
                objective=row["objective"],
                project_slug=row.get("project_slug"),
                status=MissionStatus(row.get("status", "planning")),
                steps=steps,
                artifacts=artifacts,
                created_at=row.get("created_at", 0),
                started_at=row.get("started_at"),
                finished_at=row.get("finished_at"),
                summary=row.get("summary"),
                error=row.get("error"),
            )
        except Exception as exc:
            logger.warning("[MissionStore] Failed to deserialize mission: %s", exc)
            return None
