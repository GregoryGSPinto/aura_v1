from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.models.project_models import Project


@dataclass
class ToolRoute:
    command: str
    params: Dict[str, object] = field(default_factory=dict)
    reason: str = ""


class ToolRouter:
    def route(self, message: str, projects: List[Project]) -> Optional[ToolRoute]:
        lowered = message.lower()
        project_name = self._detect_project_name(lowered, projects)

        if any(term in lowered for term in ["liste meus projetos", "listar projetos", "quais projetos", "liste os projetos"]):
            return ToolRoute(command="list_projects", reason="Solicitação explícita para listar projetos.")

        if "vscode" in lowered and any(term in lowered for term in ["abra", "abrir", "open"]):
            return ToolRoute(command="open_vscode", reason="Pedido explícito para abrir o VS Code.")

        if any(term in lowered for term in ["abra o projeto", "abrir projeto", "open project"]) and project_name:
            return ToolRoute(
                command="open_project",
                params={"name": project_name},
                reason=f"Pedido explícito para abrir o projeto {project_name}.",
            )

        if "git" in lowered and "status" in lowered:
            return ToolRoute(
                command="git_status",
                params={"name": project_name} if project_name else {},
                reason="Pedido de status do Git.",
            )

        if any(term in lowered for term in ["logs", "log", "erros recentes"]):
            return ToolRoute(command="show_logs", reason="Pedido por logs recentes.")

        if any(term in lowered for term in ["cpu", "processador"]):
            return ToolRoute(command="cpu_status", reason="Pedido por uso de CPU.")

        if any(term in lowered for term in ["memoria", "ram"]):
            return ToolRoute(command="memory_status", reason="Pedido por uso de memória.")

        if any(term in lowered for term in ["disco", "disk"]):
            return ToolRoute(command="disk_status", reason="Pedido por uso de disco.")

        if any(term in lowered for term in ["saude do sistema", "status do sistema", "system status"]):
            return ToolRoute(command="system_info", reason="Pedido por status geral do sistema.")

        if any(term in lowered for term in ["rode lint", "run lint", "pnpm lint", "lint nesse projeto"]):
            return ToolRoute(
                command="run_project_lint",
                params={"name": project_name} if project_name else {},
                reason="Pedido explícito para rodar lint.",
            )

        if any(term in lowered for term in ["rode build", "run build", "pnpm build"]):
            return ToolRoute(
                command="run_project_build",
                params={"name": project_name} if project_name else {},
                reason="Pedido explícito para rodar build.",
            )

        if any(term in lowered for term in ["rode test", "run test", "pnpm test"]):
            return ToolRoute(
                command="run_project_test",
                params={"name": project_name} if project_name else {},
                reason="Pedido explícito para rodar testes.",
            )

        if any(term in lowered for term in ["rode dev", "run dev", "suba o projeto", "ambiente local"]) and project_name:
            return ToolRoute(
                command="run_project_dev",
                params={"name": project_name},
                reason="Pedido explícito para subir ambiente local.",
            )
        return None

    def _detect_project_name(self, message: str, projects: List[Project]) -> Optional[str]:
        for project in projects:
            if project.name.lower() in message:
                return project.name
        return None
