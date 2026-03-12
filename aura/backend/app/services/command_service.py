import time
from typing import Any, Dict, Optional

from app.core.exceptions import AuraError, CommandBlockedError
from app.core.security import sanitize_mapping, sanitize_string
from app.models.command_models import CommandExecutionResult
from app.services.persistence_service import PersistenceService
from app.tools.project_tool import ProjectTool
from app.tools.system_tool import SystemTool
from app.tools.terminal_tool import TerminalTool
from app.tools.vscode_tool import VSCodeTool
from app.utils.helpers import generate_log_id, iso_now
from app.models.persistence_models import AuditLogEntry


class CommandService:
    def __init__(
        self,
        persistence_service: PersistenceService,
        project_tool: ProjectTool,
        terminal_tool: TerminalTool,
        vscode_tool: VSCodeTool,
        system_tool: SystemTool,
        logger,
    ):
        self.persistence_service = persistence_service
        self.project_tool = project_tool
        self.terminal_tool = terminal_tool
        self.vscode_tool = vscode_tool
        self.system_tool = system_tool
        self.logger = logger
        self.allowed_commands = {
            "open_terminal": self._open_terminal,
            "open_vscode": self._open_vscode,
            "open_project": self._open_project,
            "list_projects": self._list_projects,
            "run_project_dev": self._run_project_dev,
            "run_project_lint": self._run_project_lint,
            "run_project_build": self._run_project_build,
            "run_project_test": self._run_project_test,
            "git_status": self._git_status,
            "vercel_deploy": self._vercel_deploy,
            "show_logs": self._show_logs,
            "system_info": self._system_info,
            "cpu_status": self._cpu_status,
            "memory_status": self._memory_status,
            "disk_status": self._disk_status,
        }

    def is_allowed(self, command_name: str) -> bool:
        return command_name in self.allowed_commands

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
            stdout=sanitize_string(stdout),
            stderr=sanitize_string(stderr),
            metadata=sanitize_mapping(metadata),
            execution_time_ms=elapsed_ms,
            log_id=log_id,
        )

    def _open_terminal(self, params: dict):
        result = self.terminal_tool.open_terminal()
        metadata = {"platform": "macOS", **result.metadata}
        return "Terminal aberto com sucesso.", result.stdout, result.stderr, metadata

    def _open_vscode(self, params: dict):
        result = self.vscode_tool.open_app()
        return result["message"], "", "", result

    def _open_project(self, params: dict):
        name = params.get("project_name") or params.get("name")
        if not name:
            raise AuraError("validation_error", "Informe o nome do projeto.", status_code=400)
        result = self.project_tool.open_project(name)
        return result["message"], "", "", result

    def _list_projects(self, params: dict):
        projects = self.project_tool.list_projects()
        return f"{len(projects)} projeto(s) encontrado(s).", "", "", {"projects": projects}

    def _run_project_dev(self, params: dict):
        return self._run_project_script(params, "dev", "Comando dev executado para {project}.")

    def _run_project_lint(self, params: dict):
        return self._run_project_script(params, "lint", "Lint executado para {project}.")

    def _run_project_build(self, params: dict):
        return self._run_project_script(params, "build", "Build executado para {project}.")

    def _run_project_test(self, params: dict):
        return self._run_project_script(params, "test", "Testes executados para {project}.")

    def _git_status(self, params: dict):
        name = params.get("project_name") or params.get("name") or "aura_v1"
        project = self.project_tool.get_project(name)
        result = self.terminal_tool.git_status(project.path)
        return f"Status Git coletado para {project.name}.", result.stdout, result.stderr, {"project": project.name}

    def _vercel_deploy(self, params: dict):
        target = params.get("path") or None
        result = self.terminal_tool.run_script_command("vercel --prod", cwd=target or ".")
        return "Deploy Vercel iniciado.", result.stdout, result.stderr, {"path": target or "."}

    def _show_logs(self, params: dict):
        logs = self.persistence_service.get_recent_audit_logs(limit=40)
        if not logs:
            return "Ainda não há logs.", "", "", {"path": "audit_logs"}
        content = "\n".join(str(item) for item in logs)
        return "Últimas entradas de auditoria carregadas.", content, "", {"count": len(logs)}

    def _system_info(self, params: dict):
        summary = self.system_tool.summary(
            backend_status="online",
            llm_status=params.get("llm_status", "unknown"),
            persistence_mode=params.get("persistence_mode", "local"),
            auth_mode=params.get("auth_mode", "local"),
        )
        return "Resumo do sistema coletado.", "", "", summary

    def _cpu_status(self, params: dict):
        payload = self.system_tool.cpu()
        return "Uso de CPU coletado.", "", "", payload

    def _memory_status(self, params: dict):
        payload = self.system_tool.memory()
        return "Uso de memória coletado.", "", "", payload

    def _disk_status(self, params: dict):
        payload = self.system_tool.disk()
        return "Uso de disco coletado.", "", "", payload

    def _run_project_script(self, params: dict, script_name: str, message_template: str):
        name = params.get("project_name") or params.get("name") or "aura_v1"
        project = self.project_tool.get_project(name)
        result = self.project_tool.run_named_script(project.name, script_name)
        return (
            message_template.format(project=project.name),
            result.get("stdout", ""),
            result.get("stderr", ""),
            {"project": project.name, "script": script_name, "returncode": result.get("returncode", 0)},
        )

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
            "params": sanitize_mapping(params),
            "stdout": sanitize_string(stdout, max_length=1000),
            "stderr": sanitize_string(stderr, max_length=1000),
            "actor_id": actor.get("user_id") if actor else None,
            "request_id": actor.get("request_id") if actor else None,
            "metadata": sanitize_mapping(metadata),
        }
        self.logger.info("%s", line)
        self.persistence_service.record_audit_log(AuditLogEntry(**line))
