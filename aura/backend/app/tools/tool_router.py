from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional

from app.models.project_models import Project


@dataclass
class ToolRoute:
    command: str
    params: Dict[str, object] = field(default_factory=dict)
    reason: str = ""


@dataclass
class ToolAnalysis:
    status: Literal["allowed", "blocked", "unimplemented", "non_operational"]
    route: Optional[ToolRoute] = None
    reason: str = ""
    action_label: Optional[str] = None


class ToolRouter:
    BLOCKED_OPERATION_TERMS = (
        "apaga",
        "apagar",
        "delete",
        "deletar",
        "excluir",
        "remover",
        "format",
        "shutdown",
        "deslig",
        "reinici",
        "reboot",
        "killall",
        "sudo",
        "rm ",
        "rm-",
        "rm/",
    )

    OPERATIONAL_HINTS = (
        "abra",
        "abrir",
        "open",
        "launch",
        "rode",
        "rodar",
        "run ",
        "execut",
        "deploy",
        "status do git",
        "git status",
        "logs",
        "log",
        "cpu",
        "processador",
        "memoria",
        "memória",
        "ram",
        "disco",
        "disk",
        "terminal",
        "vscode",
        "projeto",
    )

    def analyze(self, message: str, projects: List[Project]) -> ToolAnalysis:
        lowered = message.lower()
        project_name = self._detect_project_name(lowered, projects)

        if any(term in lowered for term in ["liste meus projetos", "listar projetos", "quais projetos", "liste os projetos"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="list_projects", reason="Solicitação explícita para listar projetos."),
                action_label="listar projetos",
            )

        if self._is_open_terminal_request(lowered):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="open_terminal", reason="Pedido explícito para abrir o Terminal."),
                action_label="abrir Terminal",
            )

        if "vscode" in lowered and any(term in lowered for term in ["abra", "abrir", "open"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="open_vscode", reason="Pedido explícito para abrir o VS Code."),
                action_label="abrir VS Code",
            )

        if any(term in lowered for term in ["abra o projeto", "abrir projeto", "abrir o projeto", "open project"]):
            if project_name:
                return ToolAnalysis(
                    status="allowed",
                    route=ToolRoute(
                        command="open_project",
                        params={"name": project_name},
                        reason=f"Pedido explícito para abrir o projeto {project_name}.",
                    ),
                    action_label=f"abrir projeto {project_name}",
                )
            return ToolAnalysis(
                status="unimplemented",
                reason="A ação pede abertura de projeto, mas nenhum projeto conhecido foi identificado na mensagem.",
                action_label="abrir projeto",
            )

        if "git" in lowered and "status" in lowered:
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="git_status",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido de status do Git.",
                ),
                action_label="consultar status do Git",
            )

        if any(term in lowered for term in ["logs", "log", "erros recentes"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="show_logs", reason="Pedido por logs recentes."),
                action_label="mostrar logs",
            )

        if any(term in lowered for term in ["cpu", "processador"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="cpu_status", reason="Pedido por uso de CPU."),
                action_label="consultar CPU",
            )

        if any(term in lowered for term in ["memoria", "memória", "ram"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="memory_status", reason="Pedido por uso de memória."),
                action_label="consultar memória",
            )

        if any(term in lowered for term in ["disco", "disk"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="disk_status", reason="Pedido por uso de disco."),
                action_label="consultar disco",
            )

        if any(term in lowered for term in ["saude do sistema", "saúde do sistema", "status do sistema", "system status"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="system_info", reason="Pedido por status geral do sistema."),
                action_label="consultar status do sistema",
            )

        if any(term in lowered for term in ["rode lint", "run lint", "pnpm lint", "lint nesse projeto"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_lint",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar lint.",
                ),
                action_label="rodar lint",
            )

        if any(term in lowered for term in ["rode build", "run build", "pnpm build"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_build",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar build.",
                ),
                action_label="rodar build",
            )

        if any(term in lowered for term in ["rode test", "run test", "pnpm test"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_test",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar testes.",
                ),
                action_label="rodar testes",
            )

        if any(term in lowered for term in ["rode dev", "run dev", "suba o projeto", "ambiente local"]):
            if project_name:
                return ToolAnalysis(
                    status="allowed",
                    route=ToolRoute(
                        command="run_project_dev",
                        params={"name": project_name},
                        reason="Pedido explícito para subir ambiente local.",
                    ),
                    action_label=f"subir ambiente do projeto {project_name}",
                )
            return ToolAnalysis(
                status="unimplemented",
                reason="A ação pede execução de ambiente local, mas a mensagem não identifica um projeto alvo.",
                action_label="subir ambiente local",
            )

        if any(term in lowered for term in self.BLOCKED_OPERATION_TERMS):
            return ToolAnalysis(
                status="blocked",
                reason="A solicitação é operacional, mas cai fora da whitelist segura de comandos da Aura.",
            )

        if any(term in lowered for term in self.OPERATIONAL_HINTS):
            return ToolAnalysis(
                status="unimplemented",
                reason="A solicitação parece operacional, mas ainda não existe uma tool/comando implementado para ela.",
            )

        return ToolAnalysis(status="non_operational")

    def route(self, message: str, projects: List[Project]) -> Optional[ToolRoute]:
        return self.analyze(message, projects).route

    def _is_open_terminal_request(self, message: str) -> bool:
        return "terminal" in message and any(term in message for term in ["abra", "abrir", "open", "launch"])

    def _detect_project_name(self, message: str, projects: List[Project]) -> Optional[str]:
        for project in projects:
            if project.name.lower() in message:
                return project.name
        return None
