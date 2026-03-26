"""
Workspace API — Project dashboard, activity, commits, notes, next-steps.

Provides per-project workspace endpoints for the frontend dashboard.
"""

import asyncio
import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse

logger = logging.getLogger("aura")

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ── Request / Response models ──────────────────────────────────────

class UpdateNotesRequest(BaseModel):
    notes: str = Field(max_length=10000)


class UpdateNextStepsRequest(BaseModel):
    next_steps: List[str] = Field(max_items=50)


# ── Helpers ────────────────────────────────────────────────────────

def _get_memory(request: Request):
    """Get SQLiteMemoryService from app state."""
    mem = getattr(request.app.state, "sqlite_memory", None)
    if not mem:
        raise AuraError(
            "memory_unavailable",
            "SQLite memory service not initialized.",
            status_code=503,
        )
    return mem


def _get_project_or_404(request: Request, slug: str) -> Dict[str, Any]:
    """Fetch project by slug or raise 404."""
    mem = _get_memory(request)
    project = mem.get_project(slug)
    if not project:
        raise AuraError(
            "project_not_found",
            f"Project '{slug}' not found.",
            status_code=404,
        )
    return project


async def _git_log(repo_path: Path, limit: int = 10) -> List[Dict[str, str]]:
    """Run git log and return structured commits."""
    if not repo_path.is_dir() or not (repo_path / ".git").is_dir():
        return []
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "log", f"--max-count={limit}",
            "--format=%H|%h|%s|%an|%ar",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10.0)
        output = stdout.decode(errors="replace").strip()
        if not output:
            return []
        commits = []
        for line in output.split("\n"):
            if not line.strip():
                continue
            parts = line.split("|", 4)
            if len(parts) >= 5:
                commits.append({
                    "hash": parts[0],
                    "short_hash": parts[1],
                    "message": parts[2],
                    "author": parts[3],
                    "date": parts[4],
                })
        return commits
    except Exception as exc:
        logger.warning("[workspace_api] git log failed for %s: %s", repo_path, exc)
        return []


def _resolve_project_dir(project: Dict[str, Any]) -> Optional[Path]:
    """Resolve the project directory to an absolute Path, or None."""
    directory = project.get("directory")
    if not directory:
        return None
    resolved = Path(directory).expanduser().resolve()
    if resolved.is_dir():
        return resolved
    return None


# ── Endpoints ──────────────────────────────────────────────────────

@router.get(
    "/projects/{slug}/dashboard",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def get_project_dashboard(slug: str, request: Request):
    """Return project info, recent activity, deploy status, and missions."""
    project = _get_project_or_404(request, slug)

    # Recent commits
    project_dir = _resolve_project_dir(project)
    commits: List[Dict[str, str]] = []
    if project_dir:
        commits = await _git_log(project_dir, limit=5)

    # Recent missions
    missions: List[Any] = []
    mission_store = getattr(request.app.state, "mission_store", None)
    if mission_store:
        try:
            missions = mission_store.list_missions(project_slug=slug, limit=5)
        except Exception:
            pass

    # Recent long-memory activity for this project
    mem = _get_memory(request)
    activity = mem.get_long_memories(project_slug=slug, limit=10)

    # Build deploy status
    deploy_status: Optional[Dict[str, Any]] = None
    if project.get("deploy_url"):
        deploy_status = {
            "url": project["deploy_url"],
            "status": "configured",
        }

    return ApiResponse(data={
        "project": project,
        "recent_commits": commits,
        "recent_activity": activity,
        "recent_missions": missions,
        "deploy_status": deploy_status,
    })


@router.get(
    "/projects/{slug}/activity",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def get_project_activity(
    slug: str,
    request: Request,
    limit: int = 20,
    category: Optional[str] = None,
):
    """Return recent activity/logs for the project from long memory."""
    _get_project_or_404(request, slug)  # ensure project exists
    mem = _get_memory(request)
    entries = mem.get_long_memories(
        project_slug=slug,
        category=category,
        limit=min(limit, 100),
    )
    return ApiResponse(data=entries)


@router.get(
    "/projects/{slug}/commits",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def get_project_commits(
    slug: str,
    request: Request,
    limit: int = 20,
):
    """Return recent git commits for the project."""
    project = _get_project_or_404(request, slug)
    project_dir = _resolve_project_dir(project)
    if not project_dir:
        return ApiResponse(data=[])
    commits = await _git_log(project_dir, limit=min(limit, 100))
    return ApiResponse(data=commits)


@router.get(
    "/projects/{slug}/notes",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def get_project_notes(slug: str, request: Request):
    """Return project notes."""
    project = _get_project_or_404(request, slug)
    return ApiResponse(data={
        "slug": slug,
        "notes": project.get("notes") or "",
    })


@router.put(
    "/projects/{slug}/notes",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def update_project_notes(slug: str, body: UpdateNotesRequest, request: Request):
    """Update project notes."""
    _get_project_or_404(request, slug)  # ensure project exists
    mem = _get_memory(request)
    updated = mem.update_project(slug, notes=body.notes)
    if not updated:
        raise AuraError(
            "update_failed",
            f"Failed to update notes for project '{slug}'.",
            status_code=500,
        )
    return ApiResponse(data={
        "slug": slug,
        "notes": updated.get("notes") or "",
    })


@router.get(
    "/projects/{slug}/next-steps",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def get_project_next_steps(slug: str, request: Request):
    """Return project next steps."""
    project = _get_project_or_404(request, slug)
    next_steps = project.get("next_steps")
    if next_steps is None:
        next_steps = []
    elif isinstance(next_steps, str):
        try:
            import json
            next_steps = json.loads(next_steps)
        except (ValueError, TypeError):
            next_steps = []
    return ApiResponse(data={
        "slug": slug,
        "next_steps": next_steps,
    })


@router.put(
    "/projects/{slug}/next-steps",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def update_project_next_steps(
    slug: str,
    body: UpdateNextStepsRequest,
    request: Request,
):
    """Update project next steps."""
    _get_project_or_404(request, slug)  # ensure project exists
    mem = _get_memory(request)
    updated = mem.update_project(slug, next_steps=body.next_steps)
    if not updated:
        raise AuraError(
            "update_failed",
            f"Failed to update next steps for project '{slug}'.",
            status_code=500,
        )
    return ApiResponse(data={
        "slug": slug,
        "next_steps": updated.get("next_steps") or [],
    })
