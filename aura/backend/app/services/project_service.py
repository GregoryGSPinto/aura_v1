import shutil
import subprocess
from pathlib import Path
from typing import List

from app.core.exceptions import AuraError
from app.models.project_models import Project, ProjectOpenResult
from app.services.persistence_service import PersistenceService


class ProjectService:
    def __init__(self, persistence_service: PersistenceService):
        self.persistence_service = persistence_service

    def list_projects(self) -> List[Project]:
        return [Project(**project) for project in self.persistence_service.list_projects()]

    def get_project_by_name(self, name: str) -> Project:
        lowered = name.lower()
        for project in self.list_projects():
            if project.name.lower() == lowered or lowered in project.name.lower():
                return project
        raise AuraError("project_not_found", f"Projeto '{name}' não encontrado.", status_code=404)

    def open_project(self, name: str) -> ProjectOpenResult:
        project = self.get_project_by_name(name)
        project_path = Path(project.path).expanduser()
        if not project_path.exists():
            raise AuraError("project_path_invalid", "O caminho do projeto não existe.", status_code=400)

        code_bin = shutil.which("code")
        if not code_bin:
            raise AuraError(
                "vscode_not_found",
                "O comando 'code' não está disponível. Instale o Shell Command do VS Code.",
                status_code=400,
            )

        subprocess.Popen([code_bin, str(project_path)])
        return ProjectOpenResult(
            name=project.name,
            path=str(project_path),
            opened_in="vscode",
            message=f"Projeto {project.name} aberto no VS Code.",
        )
