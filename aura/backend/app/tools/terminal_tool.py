import shlex
import sys
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.core.exceptions import AuraError, CommandBlockedError
from app.core.security import BLOCKED_PATTERNS, ensure_not_blocked


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
