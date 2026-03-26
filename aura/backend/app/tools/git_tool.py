"""
AURA Git Tool — Structured Git operations with risk levels.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.tools.base import RiskLevel, ToolResult, ToolStatus


class GitTool:
    """Structured Git operations within allowed directories."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.allowed_roots = [Path(p).expanduser().resolve() for p in settings.allowed_roots]
        self.timeout = settings.command_timeout

    def _validate_repo(self, repo_path: str) -> Path:
        target = Path(repo_path).expanduser().resolve()
        for root in self.allowed_roots:
            if target == root or root in target.parents:
                if (target / ".git").is_dir():
                    return target
                raise ValueError(f"'{target}' is not a git repository")
        raise PermissionError(f"Path '{target}' is outside allowed roots")

    async def _run_git(self, args: List[str], cwd: Path) -> Dict[str, object]:
        proc = await asyncio.create_subprocess_exec(
            "git", *args,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=self.timeout,
        )
        return {
            "stdout": stdout_bytes.decode().strip(),
            "stderr": stderr_bytes.decode().strip(),
            "returncode": proc.returncode,
        }

    # ── Read-only operations (FREE) ─────────────────────────────

    async def status(self, repo_path: str) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            result = await self._run_git(["status", "--short", "--branch"], cwd)
            return ToolResult(
                tool_name="git.status",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"],
                risk_level=RiskLevel.FREE,
                metadata={"repo": str(cwd), "returncode": result["returncode"]},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.status",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.FREE,
            )

    async def log(self, repo_path: str, limit: int = 10) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            limit = min(limit, 50)
            result = await self._run_git(
                ["log", f"--max-count={limit}", "--oneline", "--decorate"],
                cwd,
            )
            return ToolResult(
                tool_name="git.log",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"],
                risk_level=RiskLevel.FREE,
                metadata={"repo": str(cwd), "limit": limit},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.log",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
            )

    async def diff(self, repo_path: str, file: Optional[str] = None) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            args = ["diff", "--stat"]
            if file:
                args.append("--")
                args.append(file)
            result = await self._run_git(args, cwd)
            # Also get the actual diff (truncated)
            detail_args = ["diff"]
            if file:
                detail_args += ["--", file]
            detail = await self._run_git(detail_args, cwd)
            diff_text = detail["stdout"][:8000]
            return ToolResult(
                tool_name="git.diff",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output={"summary": result["stdout"], "diff": diff_text},
                risk_level=RiskLevel.FREE,
                metadata={"repo": str(cwd)},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.diff",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
            )

    async def branch(self, repo_path: str) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            result = await self._run_git(["branch", "-a"], cwd)
            return ToolResult(
                tool_name="git.branch",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"],
                risk_level=RiskLevel.FREE,
                metadata={"repo": str(cwd)},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.branch",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
            )

    # ── Write operations (CONFIRM) ──────────────────────────────

    async def add(self, repo_path: str, files: Optional[List[str]] = None) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            args = ["add"]
            if files:
                args.extend(files)
            else:
                args.append(".")
            result = await self._run_git(args, cwd)
            if result["returncode"] != 0:
                return ToolResult(
                    tool_name="git.add",
                    status=ToolStatus.FAILED,
                    started_at=t0,
                    finished_at=time.time(),
                    error=result["stderr"],
                    risk_level=RiskLevel.CONFIRM,
                )
            return ToolResult(
                tool_name="git.add",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"] or "Files staged successfully",
                risk_level=RiskLevel.CONFIRM,
                metadata={"files": files or ["."]},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.add",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.CONFIRM,
            )

    async def commit(self, repo_path: str, message: str) -> ToolResult:
        t0 = time.time()
        if not message or not message.strip():
            return ToolResult.fail("git.commit", "Commit message cannot be empty")
        try:
            cwd = self._validate_repo(repo_path)
            result = await self._run_git(["commit", "-m", message.strip()], cwd)
            if result["returncode"] != 0:
                return ToolResult(
                    tool_name="git.commit",
                    status=ToolStatus.FAILED,
                    started_at=t0,
                    finished_at=time.time(),
                    error=result["stderr"] or result["stdout"],
                    risk_level=RiskLevel.CONFIRM,
                )
            return ToolResult(
                tool_name="git.commit",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"],
                risk_level=RiskLevel.CONFIRM,
                metadata={"message": message.strip()},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.commit",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.CONFIRM,
            )

    async def push(self, repo_path: str, branch: Optional[str] = None) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            args = ["push"]
            if branch:
                args.extend(["origin", branch])
            result = await self._run_git(args, cwd)
            if result["returncode"] != 0:
                return ToolResult(
                    tool_name="git.push",
                    status=ToolStatus.FAILED,
                    started_at=t0,
                    finished_at=time.time(),
                    error=result["stderr"],
                    risk_level=RiskLevel.CONFIRM,
                )
            return ToolResult(
                tool_name="git.push",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=result["stderr"] or result["stdout"] or "Push successful",
                risk_level=RiskLevel.CONFIRM,
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.push",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.CONFIRM,
            )

    async def pull(self, repo_path: str) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            result = await self._run_git(["pull"], cwd)
            return ToolResult(
                tool_name="git.pull",
                status=ToolStatus.SUCCESS if result["returncode"] == 0 else ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                output=result["stdout"] if result["returncode"] == 0 else None,
                error=result["stderr"] if result["returncode"] != 0 else None,
                risk_level=RiskLevel.CONFIRM,
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.pull",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.CONFIRM,
            )

    async def checkout(self, repo_path: str, branch: str) -> ToolResult:
        t0 = time.time()
        try:
            cwd = self._validate_repo(repo_path)
            result = await self._run_git(["checkout", branch], cwd)
            return ToolResult(
                tool_name="git.checkout",
                status=ToolStatus.SUCCESS if result["returncode"] == 0 else ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                output=result["stderr"] or result["stdout"] if result["returncode"] == 0 else None,
                error=result["stderr"] if result["returncode"] != 0 else None,
                risk_level=RiskLevel.CONFIRM,
            )
        except Exception as exc:
            return ToolResult(
                tool_name="git.checkout",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.CONFIRM,
            )
