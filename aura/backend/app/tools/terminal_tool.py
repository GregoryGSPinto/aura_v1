"""
AURA Terminal Tool — Command execution with guardrails and risk classification.
"""

from __future__ import annotations

import re
import shlex
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.core.exceptions import AuraError, CommandBlockedError
from app.core.security import BLOCKED_PATTERNS, ensure_not_blocked
from app.tools.base import RiskLevel, ToolResult, ToolStatus


MAX_OUTPUT_SIZE = 50 * 1024  # 50 KB
TIMEOUT_SECONDS = 30

# Commands that are always blocked
BLOCKED_COMMANDS = [
    "rm -rf /",
    "mkfs",
    "dd if=",
    ":(){ :|:& };:",
    "shutdown",
    "reboot",
    "> /dev/sd",
    "format c:",
    "fork bomb",
]

# Regex patterns for dangerous command detection
BLOCKED_COMMAND_PATTERNS = [
    r"rm\s+-rf\s+/(?![\w])",       # rm -rf / (root)
    r"rm\s+-rf\s+~\s*$",           # rm -rf ~ (home)
    r"sudo\s+rm",                   # sudo rm
    r"chmod\s+777\s+/",            # chmod 777 /
    r">\s*/dev/(sd|hd|nv)",        # redirect to disk device
    r"curl.*\|\s*(ba)?sh",         # pipe from internet to shell
    r"wget.*\|\s*(ba)?sh",
    r";\s*rm\s",                   # command injection via ;rm
    r"&&\s*rm\s",                  # command injection via && rm
    r"\|\s*rm\s",                  # pipe to rm
]

# Risk classification for known commands
_FREE_COMMANDS = {
    "ls", "cat", "head", "tail", "echo", "pwd", "whoami", "which", "find",
    "wc", "sort", "uniq", "grep", "rg", "ag", "fd", "tree", "file",
    "date", "uptime", "hostname", "env", "printenv", "uname",
    "du", "df", "free", "top",
}

_NOTICE_COMMANDS = {
    "git status", "git log", "git diff", "git branch", "git remote",
    "git show", "git stash list", "git tag",
    "npm list", "pnpm list", "pip list", "pip freeze",
    "docker ps", "docker images",
}

_CONFIRM_COMMANDS = {
    "git add", "git commit", "git push", "git pull", "git checkout",
    "git merge", "git rebase", "git stash",
    "npm install", "pnpm install", "pip install",
    "mkdir", "touch", "cp",
}

_CRITICAL_COMMANDS = {
    "rm", "mv", "git reset --hard", "git push --force", "git push -f",
    "git clean",
}

# Allowed working directories
ALLOWED_DIR_PATTERNS = [
    str(Path.home() / "Projetos"),
    str(Path.home() / "Projects"),
    "/tmp",
]


@dataclass
class TerminalResult:
    command: List[str]
    stdout: str = ""
    stderr: str = ""
    returncode: int = 0
    cwd: Optional[str] = None
    metadata: Dict[str, object] = field(default_factory=dict)


class TerminalTool:
    SAFE_ACTIONS = {
        "pwd": ["pwd"],
        "list_dir": ["ls", "-la"],
        "open_terminal": ["open", "-a", "Terminal"],
    }

    PROJECT_ACTIONS = {
        "git_status": ["git", "status", "--short", "--branch"],
        "git_branch": ["git", "branch"],
        "pnpm_dev": ["pnpm", "dev"],
        "pnpm_build": ["pnpm", "build"],
        "pnpm_lint": ["pnpm", "lint"],
        "pnpm_typecheck": ["pnpm", "typecheck"],
        "pnpm_test": ["pnpm", "test"],
        "uvicorn_run": ["python3", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    }

    def __init__(self, settings: Settings):
        self.settings = settings
        self.allowed_roots = [Path(p).expanduser().resolve() for p in settings.allowed_roots]

    def _validate_working_dir(self, cwd: Optional[str]) -> Optional[str]:
        """Validate working directory is within allowed paths."""
        if not cwd:
            return None
        target = Path(cwd).expanduser().resolve()
        for root in self.allowed_roots:
            if target == root or root in target.parents:
                return str(target)
        # Fallback: check pattern-based dirs
        target_str = str(target)
        for pattern in ALLOWED_DIR_PATTERNS:
            if target_str.startswith(pattern):
                return str(target)
        raise CommandBlockedError(
            "Diretório de trabalho fora das pastas autorizadas.",
            details={"path": str(target)},
        )

    def _is_blocked(self, command_str: str) -> Optional[str]:
        """Check if command is blocked. Returns reason if blocked, None otherwise."""
        lowered = command_str.lower().strip()
        for blocked in BLOCKED_COMMANDS:
            if blocked in lowered:
                return f"Command contains blocked pattern: {blocked}"
        for pattern in BLOCKED_COMMAND_PATTERNS:
            if re.search(pattern, lowered):
                return f"Command matches blocked pattern"
        return None

    def _classify_risk(self, command_str: str) -> RiskLevel:
        """Classify command risk level."""
        lowered = command_str.lower().strip()
        first_word = lowered.split()[0] if lowered.split() else ""

        # Check critical first
        for cmd in _CRITICAL_COMMANDS:
            if lowered.startswith(cmd):
                return RiskLevel.CRITICAL

        # Then confirm
        for cmd in _CONFIRM_COMMANDS:
            if lowered.startswith(cmd):
                return RiskLevel.CONFIRM

        # Then notice
        for cmd in _NOTICE_COMMANDS:
            if lowered.startswith(cmd):
                return RiskLevel.NOTICE

        # Then free
        if first_word in _FREE_COMMANDS:
            return RiskLevel.FREE

        # Default: notice for unknown commands
        return RiskLevel.NOTICE

    # ── Original interface (backward compat) ─────────────────────

    def run(
        self,
        command: List[str],
        cwd: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> TerminalResult:
        ensure_not_blocked(" ".join(command))
        for pattern in BLOCKED_PATTERNS:
            if any(pattern in part.lower() for part in command):
                raise CommandBlockedError(details={"pattern": pattern, "command": command})

        completed = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout or self.settings.command_timeout,
            check=False,
        )
        return TerminalResult(
            command=command,
            stdout=completed.stdout.strip(),
            stderr=completed.stderr.strip(),
            returncode=completed.returncode,
            cwd=cwd,
        )

    def run_named_action(self, action: str, cwd: Optional[str] = None) -> TerminalResult:
        if action in self.SAFE_ACTIONS:
            return self.run(self.SAFE_ACTIONS[action], cwd=cwd)
        if action in self.PROJECT_ACTIONS:
            return self.run(self.PROJECT_ACTIONS[action], cwd=cwd)
        raise CommandBlockedError("Ação de terminal fora da política de segurança.", details={"action": action})

    def run_script_command(self, command: str, cwd: str) -> TerminalResult:
        parts = shlex.split(command)
        if not parts:
            raise AuraError("invalid_command", "Comando vazio para execução estruturada.", status_code=400)
        return self.run(parts, cwd=cwd)

    def open_terminal(self) -> TerminalResult:
        if sys.platform != "darwin":
            raise AuraError(
                "platform_not_supported",
                "A ação open_terminal está disponível apenas no macOS.",
                details={"platform": sys.platform},
                status_code=400,
            )
        return self.run_named_action("open_terminal")

    def pwd(self, cwd: Optional[str] = None) -> TerminalResult:
        return self.run_named_action("pwd", cwd=cwd)

    def list_dir(self, cwd: Optional[str] = None) -> TerminalResult:
        return self.run_named_action("list_dir", cwd=cwd)

    def git_status(self, cwd: str) -> TerminalResult:
        return self.run_named_action("git_status", cwd=cwd)

    def git_branch(self, cwd: str) -> TerminalResult:
        return self.run_named_action("git_branch", cwd=cwd)

    def run_project_recipe(self, recipe: str, cwd: str) -> TerminalResult:
        if recipe not in self.PROJECT_ACTIONS:
            raise CommandBlockedError("Receita de projeto fora da allowlist.", details={"recipe": recipe})
        return self.run_named_action(recipe, cwd=cwd)

    def normalize_allowed_command(self, raw: str) -> Optional[str]:
        normalized = raw.strip().lower()
        aliases = {
            "git status": "git_status",
            "git_status": "git_status",
            "pwd": "pwd",
            "ls": "list_dir",
            "listar": "list_dir",
            "lint": "pnpm_lint",
            "pnpm lint": "pnpm_lint",
            "build": "pnpm_build",
            "pnpm build": "pnpm_build",
            "dev": "pnpm_dev",
            "pnpm dev": "pnpm_dev",
            "typecheck": "pnpm_typecheck",
            "pnpm typecheck": "pnpm_typecheck",
            "test": "pnpm_test",
            "pnpm test": "pnpm_test",
            "uvicorn": "uvicorn_run",
            "open terminal": "open_terminal",
            "abrir terminal": "open_terminal",
            "abra o terminal": "open_terminal",
            "abrir o terminal": "open_terminal",
            "launch terminal": "open_terminal",
        }
        return aliases.get(normalized)

    # ── Sprint 4: Execute arbitrary command with guardrails ──────

    def execute(self, command: str, working_dir: Optional[str] = None) -> ToolResult:
        """Execute a shell command with full guardrails. Returns ToolResult."""
        t0 = time.time()

        # Validate
        blocked_reason = self._is_blocked(command)
        if blocked_reason:
            return ToolResult.blocked("terminal.execute", blocked_reason)

        risk = self._classify_risk(command)

        # Validate working dir
        try:
            cwd = self._validate_working_dir(working_dir)
        except CommandBlockedError as exc:
            return ToolResult.blocked("terminal.execute", str(exc))

        try:
            ensure_not_blocked(command)
        except CommandBlockedError as exc:
            return ToolResult.blocked("terminal.execute", str(exc))

        try:
            completed = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SECONDS,
                check=False,
            )
            stdout = completed.stdout.strip()
            stderr = completed.stderr.strip()

            # Truncate large outputs
            if len(stdout) > MAX_OUTPUT_SIZE:
                stdout = stdout[:MAX_OUTPUT_SIZE] + f"\n... (truncated, {len(completed.stdout)} bytes total)"
            if len(stderr) > MAX_OUTPUT_SIZE:
                stderr = stderr[:MAX_OUTPUT_SIZE] + f"\n... (truncated, {len(completed.stderr)} bytes total)"

            if completed.returncode != 0:
                return ToolResult(
                    tool_name="terminal.execute",
                    status=ToolStatus.FAILED,
                    started_at=t0,
                    finished_at=time.time(),
                    output=stdout,
                    error=stderr or f"Exit code: {completed.returncode}",
                    risk_level=risk,
                    metadata={"command": command, "cwd": cwd, "returncode": completed.returncode},
                )

            return ToolResult(
                tool_name="terminal.execute",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=stdout or "(no output)",
                risk_level=risk,
                metadata={"command": command, "cwd": cwd, "returncode": 0},
            )
        except subprocess.TimeoutExpired:
            return ToolResult(
                tool_name="terminal.execute",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=f"Command timed out after {TIMEOUT_SECONDS}s",
                risk_level=risk,
                metadata={"command": command, "cwd": cwd},
            )
        except Exception as exc:
            return ToolResult(
                tool_name="terminal.execute",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=risk,
                metadata={"command": command, "cwd": cwd},
            )
