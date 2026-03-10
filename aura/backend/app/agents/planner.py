import re
from typing import List, Optional

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

        if any(term in normalized for term in ["lint", "build", "teste", "corrigir", "fix", "review", "revisar"]):
            steps.append(
                AgentPlanStep(
                    title="Ação fora da whitelist atual",
                    description="A meta pede lint, build, testes ou correções automáticas.",
                    status="blocked",
                    reason="A whitelist atual da Aura não inclui lint, build, testes ou correção automática de código.",
                )
            )
            notes.append("A meta foi parcialmente bloqueada porque exige ações ainda não aprovadas na whitelist.")

        if not steps:
            steps.append(
                AgentPlanStep(
                    title="Planejamento insuficiente",
                    description="Nenhum comando seguro mapeado para a meta informada.",
                    status="blocked",
                    reason="Reformule a meta em termos dos comandos aprovados: projetos, VS Code, git, logs, dev, deploy.",
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

