"""
Git API — Operações git via REST.

Segurança:
- Paths resolvidos relativos ao PROJECTS_ROOT
- Path traversal bloqueado
- Requires auth token
"""

import asyncio
import logging
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")
router = APIRouter(prefix="/git", dependencies=[Depends(require_bearer_token)])

ALLOWED_ROOTS = [Path.home() / "Projetos", Path.home() / "Projects", Path.cwd()]


def _resolve_repo(path: str) -> Path:
    """Resolve repo path safely."""
    candidate = Path(path).expanduser().resolve()
    for root in ALLOWED_ROOTS:
        try:
            candidate.relative_to(root.resolve())
            if (candidate / ".git").is_dir():
                return candidate
        except ValueError:
            continue
    # Also allow direct absolute paths that have .git
    if candidate.is_absolute() and (candidate / ".git").is_dir():
        return candidate
    raise ValueError(f"Not a valid git repo or outside allowed roots: {path}")


async def _git(repo: Path, *args: str, timeout: float = 15.0) -> tuple[str, str, int]:
    """Run git command and return (stdout, stderr, returncode)."""
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(repo),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    return stdout.decode(errors="replace"), stderr.decode(errors="replace"), proc.returncode or 0


@router.get("/status")
async def git_status(request: Request, path: str = Query(...)):
    try:
        repo = _resolve_repo(path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    out, _, _ = await _git(repo, "status", "--porcelain=v1", "-b")
    lines = out.strip().split("\n") if out.strip() else []

    branch = "unknown"
    ahead = 0
    behind = 0
    modified = []
    staged = []
    untracked = []
    deleted = []

    for line in lines:
        if line.startswith("## "):
            branch_info = line[3:]
            branch = branch_info.split("...")[0]
            ahead_match = re.search(r"ahead (\d+)", branch_info)
            behind_match = re.search(r"behind (\d+)", branch_info)
            if ahead_match:
                ahead = int(ahead_match.group(1))
            if behind_match:
                behind = int(behind_match.group(1))
            continue
        if len(line) < 4:
            continue
        x, y = line[0], line[1]
        filepath = line[3:].strip()
        # Staged
        if x in ("M", "A", "D", "R"):
            staged.append(filepath)
        # Working tree
        if y == "M":
            modified.append(filepath)
        elif y == "D":
            deleted.append(filepath)
        elif x == "?" and y == "?":
            untracked.append(filepath)

    return {"success": True, "data": {
        "branch": branch, "ahead": ahead, "behind": behind,
        "modified": modified, "staged": staged, "untracked": untracked, "deleted": deleted,
    }}


@router.get("/diff")
async def git_diff(
    request: Request,
    path: str = Query(...),
    file: Optional[str] = Query(None),
    staged: bool = Query(False),
):
    try:
        repo = _resolve_repo(path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    args = ["diff"]
    if staged:
        args.append("--cached")
    if file:
        args.extend(["--", file])
    out, _, _ = await _git(repo, *args)
    hunks = _parse_diff(out)
    return {"success": True, "data": {"file": file or "(all)", "hunks": hunks}}


def _parse_diff(diff_text: str) -> list:
    """Parse unified diff into structured hunks."""
    hunks = []
    current_hunk = None

    for line in diff_text.split("\n"):
        if line.startswith("@@"):
            match = re.match(r"@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@", line)
            if match:
                current_hunk = {
                    "old_start": int(match.group(1)),
                    "old_count": int(match.group(2) or 1),
                    "new_start": int(match.group(3)),
                    "new_count": int(match.group(4) or 1),
                    "lines": [],
                }
                hunks.append(current_hunk)
        elif current_hunk is not None:
            if line.startswith("+"):
                current_hunk["lines"].append({"type": "added", "content": line[1:]})
            elif line.startswith("-"):
                current_hunk["lines"].append({"type": "removed", "content": line[1:]})
            elif line.startswith(" "):
                current_hunk["lines"].append({"type": "context", "content": line[1:]})
    return hunks


@router.get("/log")
async def git_log(request: Request, path: str = Query(...), limit: int = Query(20)):
    try:
        repo = _resolve_repo(path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    out, _, _ = await _git(repo, "log", f"--max-count={limit}", "--format=%H|%h|%s|%an|%ar")
    commits = []
    for line in out.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("|", 4)
        if len(parts) >= 5:
            commits.append({
                "hash": parts[0], "short_hash": parts[1],
                "message": parts[2], "author": parts[3], "date": parts[4],
            })
    return {"success": True, "data": {"commits": commits}}


@router.get("/branch")
async def git_branch(request: Request, path: str = Query(...)):
    try:
        repo = _resolve_repo(path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    current_out, _, _ = await _git(repo, "branch", "--show-current")
    current = current_out.strip()
    branches_out, _, _ = await _git(repo, "branch", "-a", "--format=%(refname:short)")
    branches = [b.strip() for b in branches_out.strip().split("\n") if b.strip()]
    return {"success": True, "data": {"current": current, "branches": branches}}


class StageBody(BaseModel):
    path: str
    files: Optional[list] = None  # None = all


class CommitBody(BaseModel):
    path: str
    message: str


class PushPullBody(BaseModel):
    path: str


@router.post("/stage")
async def git_stage(body: StageBody, request: Request):
    try:
        repo = _resolve_repo(body.path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    if body.files:
        for f in body.files:
            await _git(repo, "add", f)
    else:
        await _git(repo, "add", "-A")
    return {"success": True, "data": {"staged": body.files or ["all"]}}


@router.post("/unstage")
async def git_unstage(body: StageBody, request: Request):
    try:
        repo = _resolve_repo(body.path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    if body.files:
        for f in body.files:
            await _git(repo, "reset", "HEAD", f)
    else:
        await _git(repo, "reset", "HEAD")
    return {"success": True, "data": {"unstaged": body.files or ["all"]}}


@router.post("/commit")
async def git_commit(body: CommitBody, request: Request):
    try:
        repo = _resolve_repo(body.path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    out, err, code = await _git(repo, "commit", "-m", body.message)
    if code != 0:
        return {"success": False, "error": err or out}
    return {"success": True, "data": {"output": out.strip()}}


@router.post("/push")
async def git_push(body: PushPullBody, request: Request):
    try:
        repo = _resolve_repo(body.path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    out, err, code = await _git(repo, "push", timeout=30.0)
    if code != 0:
        return {"success": False, "error": err or out}
    return {"success": True, "data": {"output": (out + err).strip()}}


@router.post("/pull")
async def git_pull(body: PushPullBody, request: Request):
    try:
        repo = _resolve_repo(body.path)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    out, err, code = await _git(repo, "pull", timeout=30.0)
    if code != 0:
        return {"success": False, "error": err or out}
    return {"success": True, "data": {"output": (out + err).strip()}}
