import re
from typing import List, Literal, Optional

from app.agents.models import AgentPlan, AgentPlanStep
from app.models.project_models import Project


class AgentPlanner:
    def create_plan(self, goal: str, projects: List[Project], title: Optional[str] = None) -> AgentPlan:
        normalized = goal.lower()
        project_name = self._detect_project_name(goal, projects)
        steps: List[AgentPlanStep] = []
        notes: List[str] = []

        if any(term in normalized for term in ["listar", "liste", "projetos", "meus projetos"]):
            steps.append(
                AgentPlanStep(
                    title="Listar projetos",
                    description="Consultar os projetos cadastrados na Aura.",
                    command="list_projects",
                )
            )

        if any(term in normalized for term in ["abrir projeto", "abra o projeto", "abrir o projeto", "open project"]):
            if project_name:
                steps.append(
                    AgentPlanStep(
                        title="Abrir projeto",
                        description=f"Abrir o projeto {project_name} no VS Code.",
                        command="open_project",
                        params={"name": project_name},
                    )
                )
            else:
                steps.append(
                    AgentPlanStep(
                        title="Projeto não identificado",
                        description="A meta pede abertura de projeto, mas nenhum projeto conhecido foi identificado.",
                        status="blocked",
                        reason="Informe explicitamente o nome do projeto.",
                    )
                )

        if "vscode" in normalized:
            steps.append(
                AgentPlanStep(
                    title="Abrir VS Code",
                    description="Abrir o VS Code localmente no Mac.",
                    command="open_vscode",
                )
            )

        if "terminal" in normalized and any(term in normalized for term in ["abra", "abrir", "open", "launch"]):
            steps.append(
                AgentPlanStep(
                    title="Abrir Terminal",
                    description="Abrir o app Terminal localmente no macOS.",
                    command="open_terminal",
                )
            )

        if "git" in normalized or "status" in normalized:
            params = {"name": project_name} if project_name else {}
            steps.append(
                AgentPlanStep(
                    title="Coletar status do Git",
                    description="Executar git status no projeto principal ou informado.",
                    command="git_status",
                    params=params,
                )
            )

        if any(term in normalized for term in ["logs", "log", "erros", "falhas"]):
            steps.append(
                AgentPlanStep(
                    title="Coletar logs",
                    description="Mostrar os logs recentes da Aura para análise.",
                    command="show_logs",
                )
            )

        if any(term in normalized for term in ["ambiente local", "rodar servidor", "rode o servidor", "run dev", "ambiente"]):
            if project_name:
                steps.append(
                    AgentPlanStep(
                        title="Rodar ambiente local",
                        description=f"Executar o comando dev do projeto {project_name}.",
                        command="run_project_dev",
                        params={"name": project_name},
                    )
                )
            else:
                steps.append(
                    AgentPlanStep(
                        title="Projeto necessário para dev",
                        description="Executar o ambiente local exige projeto explícito.",
                        status="blocked",
                        reason="Informe o projeto para o comando run_project_dev.",
                    )
                )

        if any(term in normalized for term in ["deploy", "vercel"]):
            steps.append(
                AgentPlanStep(
                    title="Preparar deploy Vercel",
                    description="Acionar o comando de deploy permitido na whitelist.",
                    command="vercel_deploy",
                )
            )

        if "lint" in normalized:
            steps.append(
                AgentPlanStep(
                    title="Rodar lint",
                    description="Executar lint seguro no projeto alvo.",
                    command="run_project_lint",
                    params={"name": project_name} if project_name else {},
                    status="planned" if project_name else "blocked",
                    reason=None if project_name else "Informe o projeto para rodar lint.",
                )
            )

        if "build" in normalized:
            steps.append(
                AgentPlanStep(
                    title="Rodar build",
                    description="Executar build seguro no projeto alvo.",
                    command="run_project_build",
                    params={"name": project_name} if project_name else {},
                    status="planned" if project_name else "blocked",
                    reason=None if project_name else "Informe o projeto para rodar build.",
                )
            )

        if any(term in normalized for term in ["teste", "test"]):
            steps.append(
                AgentPlanStep(
                    title="Rodar testes",
                    description="Executar testes seguros no projeto alvo.",
                    command="run_project_test",
                    params={"name": project_name} if project_name else {},
                    status="planned" if project_name else "blocked",
                    reason=None if project_name else "Informe o projeto para rodar testes.",
                )
            )

        if any(term in normalized for term in ["cpu", "memória", "memoria", "ram", "disco", "health do sistema", "saúde do sistema"]):
            if any(term in normalized for term in ["cpu", "processador"]):
                steps.append(
                    AgentPlanStep(
                        title="Verificar CPU",
                        description="Consultar uso atual de CPU no computador local.",
                        command="cpu_status",
                    )
                )
            if any(term in normalized for term in ["memória", "memoria", "ram"]):
                steps.append(
                    AgentPlanStep(
                        title="Verificar memória",
                        description="Consultar uso atual de memória.",
                        command="memory_status",
                    )
                )
            if "disco" in normalized:
                steps.append(
                    AgentPlanStep(
                        title="Verificar disco",
                        description="Consultar uso de disco.",
                        command="disk_status",
                    )
                )
            if any(term in normalized for term in ["health do sistema", "saúde do sistema"]):
                steps.append(
                    AgentPlanStep(
                        title="Resumo do sistema",
                        description="Consultar resumo operacional do sistema local.",
                        command="system_info",
                    )
                )

        if not steps:
            steps.append(
                AgentPlanStep(
                    title="Planejamento insuficiente",
                    description="Nenhum comando seguro mapeado para a meta informada.",
                    status="blocked",
                    reason="Reformule a meta em termos dos comandos aprovados: Terminal, projetos, VS Code, git, logs, dev e deploy.",
                )
            )
            notes.append("O planner não encontrou passos seguros compatíveis com a meta.")

        status: Literal["planned", "blocked"] = "blocked" if any(step.status == "blocked" for step in steps) else "planned"
        return AgentPlan(
            title=title or self._make_title(goal),
            goal=goal,
            status=status,
            steps=steps,
            notes=notes,
        )

    def _detect_project_name(self, goal: str, projects: List[Project]) -> Optional[str]:
        lowered = goal.lower()
        for project in projects:
            if project.name.lower() in lowered:
                return project.name

        match = re.search(r"projeto\s+([a-zA-Z0-9_\-./]+)", lowered)
        if match:
            return match.group(1)
        return None

    def _make_title(self, goal: str) -> str:
        trimmed = goal.strip()
        return trimmed[:80] if len(trimmed) > 80 else trimmed
