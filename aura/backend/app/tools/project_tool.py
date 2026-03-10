import json
from pathlib import Path
from typing import Dict, List

from app.core.exceptions import AuraError
from app.models.project_models import Project
from app.services.project_service import ProjectService
from app.tools.terminal_tool import TerminalTool
from app.tools.vscode_tool import VSCodeTool


class ProjectTool:
    def __init__(self, project_service: ProjectService, terminal_tool: TerminalTool, vscode_tool: VSCodeTool):
        self.project_service = project_service
        self.terminal_tool = terminal_tool
        self.vscode_tool = vscode_tool

    def list_projects(self) -> List[Dict[str, object]]:
        items: List[Dict[str, object]] = []
        for project in self.project_service.list_projects():
            items.append(self._serialize_project(project))
        return items

    def get_project(self, name: str) -> Project:
        return self.project_service.get_project_by_name(name)

    def open_project(self, name: str) -> Dict[str, object]:
        project = self.get_project(name)
        return self.vscode_tool.open_path(project.path)

    def inspect_project(self, name: str) -> Dict[str, object]:
        project = self.get_project(name)
        return self._serialize_project(project)

    def run_named_script(self, name: str, script_name: str) -> Dict[str, object]:
        project = self.get_project(name)
        command = self._resolve_script_command(project, script_name)
        result = self.terminal_tool.run_script_command(command, cwd=str(Path(project.path).expanduser()))
        return {
            "project": project.name,
            "script": script_name,
            "command": command,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }

    def _resolve_script_command(self, project: Project, script_name: str) -> str:
        if script_name in project.commands:
            return project.commands[script_name]

        package_json = Path(project.path).expanduser() / "package.json"
        if package_json.exists():
            try:
                payload = json.loads(package_json.read_text(encoding="utf-8"))
            except Exception as exc:
                raise AuraError("package_json_invalid", "Falha ao ler package.json do projeto.", details=str(exc), status_code=500) from exc
            scripts = payload.get("scripts", {})
            if script_name in scripts:
                return f"pnpm {script_name}"

        raise AuraError(
            "project_script_missing",
            f"O projeto não possui script '{script_name}' cadastrado.",
            status_code=404,
        )

    def _serialize_project(self, project: Project) -> Dict[str, object]:
        package_json = Path(project.path).expanduser() / "package.json"
        scripts: Dict[str, str] = {}
        if package_json.exists():
            try:
                payload = json.loads(package_json.read_text(encoding="utf-8"))
                scripts = payload.get("scripts", {})
            except Exception:
                scripts = {}
        return {
            "name": project.name,
            "path": project.path,
            "description": project.description,
            "commands": project.commands,
            "scripts": scripts,
            "has_package_json": package_json.exists(),
        }
