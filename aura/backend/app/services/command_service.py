import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.core.config import Settings
from app.core.exceptions import AuraError, CommandBlockedError
from app.models.persistence_models import AuditLogEntry
from app.core.security import BLOCKED_PATTERNS, ensure_not_blocked
from app.models.command_models import CommandExecutionResult
from app.services.persistence_service import PersistenceService
from app.services.project_service import ProjectService
from app.utils.helpers import generate_log_id, iso_now


class CommandService:
    def __init__(
        self,
        settings: Settings,
        project_service: ProjectService,
        persistence_service: PersistenceService,
        logger,
    ):
        self.settings = settings
        self.project_service = project_service
        self.persistence_service = persistence_service
        self.logger = logger
        self.allowed_commands = {
            "open_vscode": self._open_vscode,
            "open_project": self._open_project,
            "list_projects": self._list_projects,
            "run_project_dev": self._run_project_dev,
            "git_status": self._git_status,
            "vercel_deploy": self._vercel_deploy,
            "show_logs": self._show_logs,
        }

    def execute(
        self,
        command_name: str,
        params: Optional[dict] = None,
        actor: Optional[Dict[str, Any]] = None,
    ) -> CommandExecutionResult:
        params = params or {}
        started = time.perf_counter()
        log_id = generate_log_id()
        if command_name not in self.allowed_commands:
            raise CommandBlockedError(
                "Comando fora da whitelist da Aura.",
                details={"allowed_commands": list(self.allowed_commands.keys())},
            )

        try:
            message, stdout, stderr, metadata = self.allowed_commands[command_name](params)
            status = "success"
        except AuraError:
            raise
        except Exception as exc:
            self._audit(log_id, command_name, "error", params, "", str(exc), actor=actor)
            raise AuraError("command_error", "Falha ao executar o comando solicitado.", str(exc), 500) from exc

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        self._audit(log_id, command_name, status, params, stdout or "", stderr or "", actor=actor, metadata=metadata)
        return CommandExecutionResult(
            command=command_name,
            status=status,
            message=message,
            stdout=stdout,
            stderr=stderr,
            metadata=metadata,
            execution_time_ms=elapsed_ms,
            log_id=log_id,
        )

    def _run(self, args: list[str], cwd: Optional[str] = None) -> Tuple[str, str]:
        ensure_not_blocked(" ".join(args))
        completed = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=self.settings.command_timeout,
        )
        return completed.stdout.strip(), completed.stderr.strip()

    def _open_vscode(self, params: dict):
        stdout, stderr = self._run(["open", "-a", "Visual Studio Code"])
        return "VS Code aberto.", stdout, stderr, {}

    def _open_project(self, params: dict):
        name = params.get("project_name") or params.get("name")
        if not name:
            raise AuraError("validation_error", "Informe o nome do projeto.", status_code=400)
        result = self.project_service.open_project(name)
        return result.message, "", "", result.model_dump()

    def _list_projects(self, params: dict):
        projects = [project.model_dump() for project in self.project_service.list_projects()]
        return f"{len(projects)} projeto(s) encontrado(s).", "", "", {"projects": projects}

    def _run_project_dev(self, params: dict):
        name = params.get("project_name") or params.get("name")
        if not name:
            raise AuraError("validation_error", "Informe o projeto para rodar.", status_code=400)
        project = self.project_service.get_project_by_name(name)
        dev_command = project.commands.get("dev")
        if not dev_command:
            raise AuraError("project_command_missing", "O projeto não possui comando 'dev' cadastrado.", status_code=400)
        parts = dev_command.split()
        if any(pattern in dev_command.lower() for pattern in BLOCKED_PATTERNS):
            raise CommandBlockedError()
        stdout, stderr = self._run(parts, cwd=str(Path(project.path)))
        return f"Comando dev executado para {project.name}.", stdout, stderr, {"project": project.name}

    def _git_status(self, params: dict):
        name = params.get("project_name") or params.get("name")
        project = self.project_service.get_project_by_name(name) if name else self.project_service.get_project_by_name("aura_v1")
        stdout, stderr = self._run(["git", "status", "--short", "--branch"], cwd=project.path)
        return f"Status Git coletado para {project.name}.", stdout, stderr, {"project": project.name}

    def _vercel_deploy(self, params: dict):
        target = params.get("path") or str(Path.cwd())
        stdout, stderr = self._run(["vercel", "--prod"], cwd=target)
        return "Deploy Vercel iniciado.", stdout, stderr, {"path": target}

    def _show_logs(self, params: dict):
        logs = self.persistence_service.get_recent_audit_logs(limit=40)
        if not logs:
            return "Ainda não há logs.", "", "", {"path": self.settings.audit_log_file}
        content = "\n".join(str(item) for item in logs)
        return "Últimas entradas de auditoria carregadas.", content, "", {"count": len(logs)}

    def _audit(
        self,
        log_id: str,
        command: str,
        status: str,
        params: dict,
        stdout: str,
        stderr: str,
        actor: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        line = {
            "log_id": log_id,
            "timestamp": iso_now(),
            "command": command,
            "status": status,
            "params": params,
            "stdout": stdout[:1000],
            "stderr": stderr[:1000],
            "actor_id": actor.get("user_id") if actor else None,
            "metadata": metadata or {},
        }
        self.logger.info("%s", line)
        self.persistence_service.record_audit_log(AuditLogEntry(**line))
