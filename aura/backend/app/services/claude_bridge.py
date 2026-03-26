"""
AURA Claude Bridge — Structured mission execution via Claude Code CLI.

Sprint 5: Professional Claude Code integration with missions,
output parsing, retry logic, and WebSocket progress events.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Mission model ────────────────────────────────────────────────


@dataclass
class ClaudeMission:
    id: str
    objective: str
    project_slug: str
    working_dir: str
    prompt: str
    status: str  # queued, running, blocked, needs_approval, done, failed, cancelled
    created_at: float
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    output_raw: Optional[str] = None
    output_parsed: Optional[dict] = None
    files_changed: Optional[list] = None
    diff_summary: Optional[str] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 2

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "objective": self.objective,
            "project_slug": self.project_slug,
            "working_dir": self.working_dir,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "output_parsed": self.output_parsed,
            "files_changed": self.files_changed,
            "diff_summary": self.diff_summary,
            "error": self.error,
            "retry_count": self.retry_count,
            "duration_s": round(self.finished_at - self.started_at, 1) if self.finished_at and self.started_at else None,
        }


# ── Output parser ────────────────────────────────────────────────


class ClaudeOutputParser:
    """Parse Claude Code CLI output into structured data."""

    _FILE_PATTERN = re.compile(r'(?:^|\s)([\w./-]+\.\w{1,10})(?:\s|$|:|\()', re.MULTILINE)
    _CODE_BLOCK = re.compile(r'```[\w]*\n(.*?)```', re.DOTALL)
    _ERROR_KEYWORDS = ["error", "erro", "failed", "falha", "traceback", "exception"]
    _NEXT_KEYWORDS = ["próximo", "next step", "sugest", "todo", "recomend"]

    @classmethod
    def parse(cls, raw_output: str) -> Dict[str, Any]:
        if not raw_output:
            return {"summary": "", "files_mentioned": [], "errors_found": [], "next_steps": [], "code_blocks": [], "success": False}

        lines = raw_output.strip().splitlines()
        summary_lines = []
        errors: List[str] = []
        next_steps: List[str] = []

        for line in lines[:5]:
            if line.strip():
                summary_lines.append(line.strip())

        for line in lines:
            lowered = line.lower()
            if any(kw in lowered for kw in cls._ERROR_KEYWORDS):
                errors.append(line.strip())
            if any(kw in lowered for kw in cls._NEXT_KEYWORDS):
                next_steps.append(line.strip())

        files = list(set(cls._FILE_PATTERN.findall(raw_output)))
        code_blocks = cls._CODE_BLOCK.findall(raw_output)
        has_error = len(errors) > 0 and not any("fixed" in e.lower() or "resolved" in e.lower() for e in errors)

        return {
            "summary": "\n".join(summary_lines[:3]),
            "files_mentioned": files[:30],
            "errors_found": errors[:10],
            "next_steps": next_steps[:10],
            "code_blocks": [cb[:500] for cb in code_blocks[:5]],
            "success": not has_error,
        }


# ── Bridge service ───────────────────────────────────────────────


class ClaudeBridge:
    """Manages Claude Code missions with structured execution and tracking."""

    MISSION_TIMEOUT = 300  # 5 minutes

    def __init__(self, sqlite_memory=None):
        self.missions: Dict[str, ClaudeMission] = {}
        self.current_mission: Optional[str] = None
        self.queue: List[str] = []
        self.sqlite_memory = sqlite_memory

    async def create_mission(
        self,
        objective: str,
        project_slug: str,
        working_dir: str,
        context: str = "",
        preferences: Optional[Dict[str, str]] = None,
    ) -> ClaudeMission:
        mission_id = str(uuid.uuid4())

        # Enrich with SQLite memory context if available
        enriched_prefs = dict(preferences) if preferences else {}
        extra_context = context
        if self.sqlite_memory:
            try:
                mem_prefs = self.sqlite_memory.get_preferences()
                for p in mem_prefs:
                    key = p.get("key", "") if isinstance(p, dict) else ""
                    val = p.get("value", "") if isinstance(p, dict) else ""
                    if key and key not in enriched_prefs:
                        enriched_prefs[key] = val
                project_info = self.sqlite_memory.get_project(project_slug)
                if project_info:
                    pname = project_info.get("name", project_slug) if isinstance(project_info, dict) else project_slug
                    pstack = project_info.get("stack", []) if isinstance(project_info, dict) else []
                    pdir = project_info.get("directory", "") if isinstance(project_info, dict) else ""
                    extra_context = f"Projeto: {pname}\nStack: {', '.join(pstack) if pstack else 'N/A'}\nDir: {pdir}\n{extra_context}".strip()
            except Exception as exc:
                logger.warning("[ClaudeBridge] Failed to enrich from SQLite memory: %s", exc)

        prompt = self.build_mission_prompt(objective, project_slug, working_dir, enriched_prefs, extra_context)
        mission = ClaudeMission(
            id=mission_id,
            objective=objective,
            project_slug=project_slug,
            working_dir=working_dir,
            prompt=prompt,
            status="queued",
            created_at=time.time(),
        )
        self.missions[mission_id] = mission
        self.queue.append(mission_id)
        logger.info("[ClaudeBridge] Mission created: %s — %s", mission_id[:8], objective[:60])
        return mission

    async def execute_mission(self, mission_id: str) -> ClaudeMission:
        mission = self.missions.get(mission_id)
        if not mission:
            raise KeyError(f"Mission {mission_id} not found")
        if mission.status not in ("queued", "failed"):
            raise ValueError(f"Mission {mission_id} is {mission.status}, cannot execute")

        mission.status = "running"
        mission.started_at = time.time()
        self.current_mission = mission_id

        await self._emit_progress(mission, "running", "Claude está trabalhando...")

        try:
            proc = await asyncio.create_subprocess_exec(
                "claude", "-p", mission.prompt, "--no-input",
                cwd=mission.working_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=self.MISSION_TIMEOUT,
            )
            output = stdout_bytes.decode("utf-8", errors="ignore").strip()
            error_output = stderr_bytes.decode("utf-8", errors="ignore").strip()

            mission.output_raw = output
            mission.output_parsed = ClaudeOutputParser.parse(output)

            if proc.returncode != 0 and not output:
                mission.status = "failed"
                mission.error = error_output or f"Exit code: {proc.returncode}"
            else:
                mission.status = "done"
                mission.error = None

            # Capture git diff
            try:
                diff_proc = await asyncio.create_subprocess_exec(
                    "git", "diff", "--stat",
                    cwd=mission.working_dir,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                diff_out, _ = await asyncio.wait_for(diff_proc.communicate(), timeout=10)
                diff_stat = diff_out.decode().strip()
                if diff_stat:
                    mission.files_changed = [
                        line.split("|")[0].strip()
                        for line in diff_stat.splitlines()
                        if "|" in line
                    ]
                    # Get actual diff (truncated)
                    full_diff_proc = await asyncio.create_subprocess_exec(
                        "git", "diff",
                        cwd=mission.working_dir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    full_diff_out, _ = await asyncio.wait_for(full_diff_proc.communicate(), timeout=10)
                    mission.diff_summary = full_diff_out.decode()[:5000]
            except Exception:
                pass

        except asyncio.TimeoutError:
            mission.status = "failed"
            mission.error = f"Mission timed out after {self.MISSION_TIMEOUT}s"
        except FileNotFoundError:
            mission.status = "failed"
            mission.error = "Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code"
        except Exception as exc:
            mission.status = "failed"
            mission.error = str(exc)
        finally:
            mission.finished_at = time.time()
            self.current_mission = None
            if mission_id in self.queue:
                self.queue.remove(mission_id)

        # Auto-retry on failure
        if mission.status == "failed" and mission.retry_count < mission.max_retries:
            mission.retry_count += 1
            mission.status = "queued"
            self.queue.append(mission_id)
            logger.info("[ClaudeBridge] Mission %s failed, requeueing (attempt %d)", mission_id[:8], mission.retry_count)

        await self._emit_progress(mission, mission.status, "Missão concluída" if mission.status == "done" else mission.error)
        return mission

    async def get_mission_status(self, mission_id: str) -> ClaudeMission:
        mission = self.missions.get(mission_id)
        if not mission:
            raise KeyError(f"Mission {mission_id} not found")
        return mission

    async def cancel_mission(self, mission_id: str) -> bool:
        mission = self.missions.get(mission_id)
        if not mission:
            return False
        if mission.status in ("done", "cancelled"):
            return False
        mission.status = "cancelled"
        mission.finished_at = time.time()
        if mission_id in self.queue:
            self.queue.remove(mission_id)
        return True

    async def list_missions(
        self,
        project_slug: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        missions = list(self.missions.values())
        if project_slug:
            missions = [m for m in missions if m.project_slug == project_slug]
        if status:
            missions = [m for m in missions if m.status == status]
        missions.sort(key=lambda m: m.created_at, reverse=True)
        return [m.to_dict() for m in missions[:limit]]

    def build_mission_prompt(
        self,
        objective: str,
        project_slug: str,
        working_dir: str,
        preferences: Dict[str, str],
        extra_context: str = "",
    ) -> str:
        prefs_text = "\n".join(f"- {k}: {v}" for k, v in preferences.items()) if preferences else "- Não especificado"
        parts = [
            f"Projeto: {project_slug}",
            f"Diretório: {working_dir}",
            "",
            "Preferências do desenvolvedor:",
            prefs_text,
        ]
        if extra_context:
            parts.append(f"\nContexto adicional:\n{extra_context}")
        parts.extend([
            f"\nOBJETIVO: {objective}",
            "",
            "INSTRUÇÕES:",
            "1. Analise o código existente antes de fazer alterações",
            "2. Faça alterações mínimas e cirúrgicas",
            "3. Mantenha consistência com o código existente",
            "4. No final, liste: arquivos alterados, o que foi feito, erros encontrados, próximos passos",
        ])
        return "\n".join(parts)

    async def _emit_progress(self, mission: ClaudeMission, status: str, message: Optional[str] = None) -> None:
        try:
            from app.services.websocket_manager import ws_manager
            event = {
                "type": "mission.progress",
                "mission_id": mission.id,
                "status": status,
                "objective": mission.objective,
                "message": message,
                "ts": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            }
            await ws_manager.broadcast(event)
        except Exception:
            pass
