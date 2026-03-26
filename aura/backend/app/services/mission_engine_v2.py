"""
Sprint 15 — Mission Engine V2.

Enhanced mission autonomy with replanning, smart retry, blocker detection, and evaluation.
"""

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Autonomy Levels ─────────────────────────────────────────────

AUTONOMY_L1 = {"terminal.read", "filesystem.read_file", "filesystem.list_directory", "filesystem.find_files",
               "git.status", "git.log", "git.diff", "git.branch", "browser.fetch_url", "browser.check_url",
               "doc.read_doc", "doc.search_in_doc", "system.summary"}

AUTONOMY_L2 = {"terminal.execute", "filesystem.write_file", "git.add", "git.commit", "git.push",
               "github.create_repo", "github.create_branch", "github.create_issue", "github.create_pull_request",
               "vercel.create_project", "vercel.trigger_deploy", "vercel.set_env_vars",
               "email.send", "calendar.create_event", "claude.execute"}

AUTONOMY_L3 = {"filesystem.delete_file", "git.force_push", "github.delete_repo", "vercel.delete_project"}


class MissionReplanner:
    """Replans failed missions from the point of failure."""

    _TRANSIENT_PATTERNS = ["timeout", "connection", "network", "503", "429", "rate limit"]
    _CRITICAL_PATTERNS = ["auth", "permission", "forbidden", "401", "403", "credentials"]

    def __init__(self, ollama_service=None):
        self.ollama = ollama_service

    def should_replan(self, error: str) -> str:
        """Returns: 'retry', 'replan', or 'stop'."""
        error_lower = error.lower()
        if any(p in error_lower for p in self._TRANSIENT_PATTERNS):
            return "retry"
        if any(p in error_lower for p in self._CRITICAL_PATTERNS):
            return "stop"
        return "replan"

    async def replan(self, objective: str, failed_step_desc: str, error_context: str, remaining_steps: int) -> List[Dict[str, Any]]:
        if not self.ollama:
            return [{"order": 1, "description": f"Retry: {failed_step_desc}", "tool": "claude_code", "params": {"objective": objective}}]
        try:
            prompt = (
                f"A etapa '{failed_step_desc}' falhou com: {error_context}\n"
                f"Objetivo original: {objective}\n"
                f"Restam {remaining_steps} etapas.\n"
                f"Sugira etapas alternativas (JSON array com description, tool, params)."
            )
            text, _ = await self.ollama.generate_response(prompt, [], think=False)
            import json, re
            match = re.search(r'\[[\s\S]*\]', text)
            if match:
                return json.loads(match.group())
        except Exception:
            pass
        return [{"order": 1, "description": f"Retry: {failed_step_desc}", "tool": "claude_code", "params": {"objective": objective}}]


class SmartRetry:
    """Intelligent retry with exponential backoff."""

    MAX_RETRIES = 3
    BASE_DELAY = 2

    def should_retry(self, error: str, retry_count: int) -> tuple:
        """Returns (should_retry: bool, delay_seconds: float)."""
        if retry_count >= self.MAX_RETRIES:
            return (False, 0)
        error_lower = error.lower()
        transient = any(p in error_lower for p in ["timeout", "connection", "network", "503", "429"])
        if transient:
            delay = self.BASE_DELAY * (2 ** retry_count)
            return (True, delay)
        return (False, 0)


class BlockerDetector:
    """Detects mission blockers."""

    def check_blockers(self, mission_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
        blockers: List[Dict[str, Any]] = []
        steps = mission_dict.get("steps", [])

        # Repeated failures
        failed_steps = [s for s in steps if s.get("status") == "failed"]
        if len(failed_steps) > 2:
            blockers.append({
                "type": "repeated_failures",
                "message": f"{len(failed_steps)} etapas falharam",
                "suggestion": "Considere cancelar e replanejar a missao",
            })

        # Long running without progress
        started = mission_dict.get("started_at")
        if started and (time.time() - started) > 600:
            completed = mission_dict.get("completed_steps", 0)
            total = mission_dict.get("total_steps", 0)
            if total > 0 and completed / total < 0.5:
                blockers.append({
                    "type": "slow_progress",
                    "message": "Missao rodando ha mais de 10min com menos de 50% de progresso",
                    "suggestion": "Verificar se ha um step travado",
                })

        return blockers


class MissionEvaluator:
    """Evaluates mission success."""

    def evaluate(self, mission_dict: Dict[str, Any]) -> Dict[str, Any]:
        steps = mission_dict.get("steps", [])
        total = len(steps)
        succeeded = sum(1 for s in steps if s.get("status") == "success")
        failed = sum(1 for s in steps if s.get("status") == "failed")

        if total == 0:
            score = 0
        else:
            score = int((succeeded / total) * 100)

        issues: List[str] = []
        for s in steps:
            if s.get("status") == "failed":
                issues.append(f"Step {s.get('order')}: {s.get('error', 'unknown error')}")

        return {
            "success": score >= 80,
            "score": score,
            "total_steps": total,
            "succeeded": succeeded,
            "failed": failed,
            "issues": issues,
            "summary": f"{succeeded}/{total} etapas concluidas com sucesso (score: {score}/100)",
        }


class MissionSummarizer:
    """Generates executive summaries for completed missions."""

    def __init__(self, ollama_service=None):
        self.ollama = ollama_service

    async def summarize(self, mission_dict: Dict[str, Any], evaluation: Dict[str, Any]) -> str:
        objective = mission_dict.get("objective", "")
        status = mission_dict.get("status", "unknown")
        duration = mission_dict.get("duration_s")
        score = evaluation.get("score", 0)
        issues = evaluation.get("issues", [])

        summary = f"## Missao: {objective}\n"
        summary += f"**Status**: {'Concluida' if status == 'completed' else 'Falhou' if status == 'failed' else status}\n"
        if duration:
            summary += f"**Tempo**: {duration}s\n"
        summary += f"**Sucesso**: {score}/100\n\n"

        steps = mission_dict.get("steps", [])
        if steps:
            summary += "### O que foi feito:\n"
            for s in steps:
                icon = "ok" if s.get("status") == "success" else "x" if s.get("status") == "failed" else "-"
                summary += f"- [{icon}] {s.get('description', '')}\n"

        if issues:
            summary += "\n### Problemas encontrados:\n"
            for issue in issues:
                summary += f"- {issue}\n"

        return summary

    async def save_summary(self, mission_dict: Dict[str, Any], summary: str, sqlite_memory=None) -> None:
        if sqlite_memory:
            try:
                sqlite_memory.add_long_memory(
                    category="mission_summary",
                    content=summary[:2000],
                    project_slug=mission_dict.get("project_slug"),
                )
            except Exception:
                pass
