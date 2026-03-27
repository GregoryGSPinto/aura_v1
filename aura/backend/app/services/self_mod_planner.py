"""
Self-Modification Planner — Gera plano de modificação para aprovação.

Quando Gregory pede pra Aura se modificar, o planner:
1. Analisa o que precisa mudar
2. Lista os arquivos que serão afetados
3. Descreve as mudanças em linguagem clara
4. Estima o impacto (risco, precisa reiniciar?)
5. Apresenta tudo pro Gregory aprovar ANTES de executar

Nada é executado sem aprovação explícita.
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime

from app.services.self_mod_detector import SelfModAnalysis

logger = logging.getLogger("aura")


@dataclass
class ModificationPlan:
    id: str
    timestamp: str
    request: str  # O que Gregory pediu
    analysis: Dict[str, Any]  # SelfModAnalysis como dict
    plan_description: str  # Descrição humana do plano
    files_affected: list  # Lista de arquivos que serão modificados
    steps: list  # Passos que serão executados
    risk_level: str
    requires_restart: bool
    requires_rebuild: bool
    claude_code_prompt: str  # O prompt que será enviado pro Claude Code
    status: str  # "pending_approval" | "approved" | "rejected" | "executing" | "completed" | "failed"
    result: Optional[str] = None


class SelfModPlanner:
    """
    Gera planos de auto-modificação para aprovação do Gregory.
    """

    def __init__(self, llm_client=None):
        self.llm_client = llm_client  # Claude API ou Ollama pra gerar o plano
        self.plans: Dict[str, ModificationPlan] = {}

    async def create_plan(self, request: str, analysis: SelfModAnalysis) -> ModificationPlan:
        """
        Cria um plano de modificação baseado no pedido e na análise.

        Se tiver LLM client disponível, usa pra gerar plano inteligente.
        Se não, gera plano básico baseado em patterns.
        """
        plan_id = f"selfmod_{int(datetime.now().timestamp())}"

        # Gerar o prompt que será enviado pro Claude Code
        claude_prompt = self._build_claude_code_prompt(request, analysis)

        # Inferir arquivos afetados e passos
        files, steps = self._infer_changes(request, analysis)

        plan = ModificationPlan(
            id=plan_id,
            timestamp=datetime.now().isoformat(),
            request=request,
            analysis=asdict(analysis) if hasattr(analysis, '__dataclass_fields__') else {},
            plan_description=self._generate_description(request, analysis, files, steps),
            files_affected=files,
            steps=steps,
            risk_level=analysis.risk_level,
            requires_restart="backend" in analysis.affected_areas,
            requires_rebuild="frontend" in analysis.affected_areas,
            claude_code_prompt=claude_prompt,
            status="pending_approval",
        )

        self.plans[plan_id] = plan
        logger.info(f"[SelfMod] Plano criado: {plan_id} — {plan.plan_description}")

        return plan

    def _build_claude_code_prompt(self, request: str, analysis: SelfModAnalysis) -> str:
        """Constrói o prompt que será enviado pro Claude Code CLI."""

        areas = ", ".join(analysis.affected_areas)

        prompt = f"""Leia ~/Projetos/aura_v1/CLAUDE.md para contexto do projeto.

TAREFA: {request}

Áreas afetadas: {areas}

REGRAS:
1. Leia os arquivos existentes ANTES de modificar
2. NÃO quebre o que já funciona
3. Siga o padrão de código existente (imports, naming, estrutura)
4. Se criar nova tool, registre no __init__.py e no router.py
5. Se modificar backend, rode: cd ~/Projetos/aura_v1/aura/backend && python3 -c "from app.main import create_app; print('OK')"
6. Se modificar frontend, rode: cd ~/Projetos/aura_v1/aura/frontend && pnpm tsc --noEmit
7. No final, mostre resumo de todos os arquivos criados/modificados
8. NÃO faça commit — o protocolo de auto-modificação faz isso depois

Implemente agora. Não pergunte nada."""

        return prompt

    def _infer_changes(self, request: str, analysis: SelfModAnalysis) -> tuple:
        """Infere quais arquivos serão afetados e quais passos serão executados."""
        files = []
        steps = []

        request_lower = request.lower()

        if "tool" in request_lower or "ferramenta" in request_lower:
            files.extend([
                "backend/app/tools/novo_tool.py (criar)",
                "backend/app/tools/__init__.py (registrar)",
                "backend/app/api/v1/router.py (se precisar endpoint)",
            ])
            steps.extend([
                "Criar arquivo da tool com BaseTool",
                "Registrar no tool registry",
                "Testar importação",
            ])

        if "endpoint" in request_lower or "rota" in request_lower:
            files.extend([
                "backend/app/api/v1/endpoints/novo_endpoint.py (criar)",
                "backend/app/api/v1/router.py (registrar)",
            ])
            steps.extend([
                "Criar endpoint com FastAPI router",
                "Registrar no router principal",
                "Testar resposta",
            ])

        if "componente" in request_lower or "tela" in request_lower or "frontend" in request_lower:
            files.extend([
                "frontend/components/novo_componente.tsx (criar/modificar)",
            ])
            steps.extend([
                "Criar/modificar componente React",
                "TypeScript check",
                "Build check",
            ])

        if "config" in request_lower or "timeout" in request_lower or ".env" in request_lower:
            files.extend([
                "backend/app/core/config.py (modificar)",
                "backend/.env (se necessário)",
            ])
            steps.extend([
                "Modificar configuração",
                "Verificar que backend inicia",
            ])

        # Steps finais sempre
        steps.extend([
            "Validar que nada quebrou",
            "Reportar resultado ao Gregory",
        ])

        if not files:
            files = ["(será determinado pelo Claude Code durante execução)"]

        return files, steps

    def _generate_description(self, request: str, analysis: SelfModAnalysis,
                              files: list, steps: list) -> str:
        """Gera descrição legível do plano."""
        areas = " e ".join(analysis.affected_areas)
        risk_emoji = {"low": "\U0001f7e2", "medium": "\U0001f7e1", "high": "\U0001f534"}[analysis.risk_level]
        restart = "\u26a0\ufe0f Requer reinício do backend." if analysis.requires_restart else ""

        nl = "\n"
        files_str = nl.join(f"  \u2022 {f}" for f in files)
        steps_str = nl.join(f"  {i+1}. {s}" for i, s in enumerate(steps))

        desc = f"""AUTO-MODIFICAÇÃO DETECTADA {risk_emoji}

\U0001f4cb Pedido: "{request}"
\U0001f3af Tipo: {analysis.description}
\U0001f4c1 Áreas: {areas}
{restart}

Arquivos que serão afetados:
{files_str}

Passos:
{steps_str}"""

        return desc

    def get_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        return self.plans.get(plan_id)

    def approve_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        plan = self.plans.get(plan_id)
        if plan and plan.status == "pending_approval":
            plan.status = "approved"
            return plan
        return None

    def reject_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        plan = self.plans.get(plan_id)
        if plan and plan.status == "pending_approval":
            plan.status = "rejected"
            return plan
        return None

    def complete_plan(self, plan_id: str, result: str):
        plan = self.plans.get(plan_id)
        if plan:
            plan.status = "completed"
            plan.result = result

    def fail_plan(self, plan_id: str, error: str):
        plan = self.plans.get(plan_id)
        if plan:
            plan.status = "failed"
            plan.result = f"ERRO: {error}"
