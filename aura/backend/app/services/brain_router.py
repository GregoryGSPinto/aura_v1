"""
Brain Router — classifies message complexity and decides which brain to use.

LOCAL (Qwen via Ollama): fast, free, good for simple conversations.
CLOUD (Claude API): powerful, paid, necessary for complex reasoning/tool calling.
"""

import re
from enum import Enum
from typing import Optional


class BrainTarget(Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class ComplexityLevel(Enum):
    TRIVIAL = 1
    SIMPLE = 2
    MODERATE = 3
    COMPLEX = 4
    CRITICAL = 5


class BrainRouter:
    def __init__(self, cloud_available: bool = False, daily_budget_cents: int = 200):
        self.cloud_available = cloud_available
        self.daily_budget_cents = daily_budget_cents
        self.cost_per_cloud_call_cents = 3
        self.usage_today = {"local": 0, "cloud": 0}
        self._routing_stats = {level.name.lower(): 0 for level in ComplexityLevel}

    def classify(self, message: str, context: Optional[dict] = None) -> dict:
        """Classify message complexity and decide which brain to use."""
        message_lower = message.lower().strip()

        # TRIVIAL → always LOCAL
        trivial_patterns = [
            r"^(oi|olá|ola|hey|e aí|eai|fala|salve|bom dia|boa tarde|boa noite)\b",
            r"^(obrigado|valeu|vlw|thanks|brigado|tmj)\b",
            r"^(sim|não|nao|ok|beleza|blz|show|top|massa)\b",
            r"^(tchau|bye|até|ate|falou)\b",
            r"^(tudo bem|como vai|td bem)\??$",
        ]
        for pattern in trivial_patterns:
            if re.match(pattern, message_lower):
                return self._result(
                    BrainTarget.LOCAL, ComplexityLevel.TRIVIAL, "Saudacao/confirmacao simples"
                )

        # Check for planning requirements → CRITICAL
        requires_planning = any(
            re.search(p, message_lower)
            for p in [
                r"(cria.*e.*deploy|faz.*e.*publica|implementa.*e.*testa)",
                r"(primeiro.*depois|etapa|passo|step)",
                r"(missão|missao|objetivo|meta)",
            ]
        )
        if requires_planning:
            return self._result(
                BrainTarget.CLOUD,
                ComplexityLevel.CRITICAL,
                "Requer planejamento multi-step",
                requires_tools=True,
                requires_planning=True,
            )

        # Check for tool calling requirements → COMPLEX
        requires_tools = any(
            re.search(p, message_lower)
            for p in [
                r"(git |npm |pnpm |pip |terminal|arquivo|deploy|github|vercel)",
                r"(abre|acess|busca|pesquisa|url|link)",
                r"(lê|le|ler|leia|resume|resumir) (esse|este|o) (arquivo|doc|código|codigo)",
            ]
        )
        if requires_tools:
            return self._result(
                BrainTarget.CLOUD,
                ComplexityLevel.COMPLEX,
                "Requer tool calling",
                requires_tools=True,
            )

        # COMPLEX/CRITICAL triggers
        cloud_triggers = [
            r"(execut|rod[ae]|faz|cria|deploy|instala|configura|publica|sobe)",
            r"(missão|missao|mission|plano|planeja|organiza.*projeto)",
            r"(analisa|compara|avalia|diagnostica|investiga|debug)",
            r"(o que (voce|vc|você) (acha|recomenda|sugere))",
            r"(qual (melhor|pior|ideal)|devo|deveria|vale a pena)",
            r"(refatora|implementa|arquitetura|design pattern|otimiza)",
            r"(todos os projetos|meus projetos|status geral|briefing)",
            r"(explica.*(detalhad|completo|fundo|aprofundad)|como funciona|por que|por qu[eê])",
            r"(diferença entre|vantagem|desvantagem|quando usar|melhor opção)",
            r"<tool_call>",
        ]

        is_complex = any(re.search(p, message_lower) for p in cloud_triggers)
        is_long = len(message) > 150
        has_code = "```" in message or "function" in message_lower or "def " in message_lower

        if is_complex or (is_long and has_code):
            return self._result(
                BrainTarget.CLOUD, ComplexityLevel.COMPLEX, "Analise ou raciocinio complexo"
            )

        if is_long:
            return self._result(
                BrainTarget.CLOUD, ComplexityLevel.MODERATE, "Mensagem longa requer raciocinio detalhado"
            )

        # SIMPLE → LOCAL
        return self._result(
            BrainTarget.LOCAL, ComplexityLevel.SIMPLE, "Pergunta simples ou conversa casual"
        )

    def _result(
        self,
        target: BrainTarget,
        complexity: ComplexityLevel,
        reason: str,
        requires_tools: bool = False,
        requires_planning: bool = False,
    ) -> dict:
        # Fallback to local if cloud not available
        if target == BrainTarget.CLOUD and not self.cloud_available:
            target = BrainTarget.LOCAL
            reason += " [FALLBACK: Claude API nao configurada]"

        # Budget check
        if target == BrainTarget.CLOUD:
            estimated_cost = self.usage_today["cloud"] * self.cost_per_cloud_call_cents
            if estimated_cost >= self.daily_budget_cents:
                target = BrainTarget.LOCAL
                reason += " [FALLBACK: budget diario atingido]"

        return {
            "target": target,
            "complexity": complexity,
            "reason": reason,
            "requires_tools": requires_tools,
            "requires_planning": requires_planning,
        }

    def track_usage(self, target: BrainTarget, tokens_used: int = 0) -> None:
        """Record usage for budget control."""
        self.usage_today[target.value] = self.usage_today.get(target.value, 0) + 1
        self._routing_stats[
            next(
                (
                    level.name.lower()
                    for level in ComplexityLevel
                    if level.value == tokens_used
                ),
                "simple",
            )
        ] += 1

    def track_classification(self, complexity: ComplexityLevel) -> None:
        """Track routing stats by complexity level."""
        key = complexity.name.lower()
        self._routing_stats[key] = self._routing_stats.get(key, 0) + 1

    def get_status(self) -> dict:
        """Return current brain router status for the /brain/status endpoint."""
        budget_used_cents = self.usage_today["cloud"] * self.cost_per_cloud_call_cents
        return {
            "local": {
                "status": "online",
                "model": "qwen3.5:9b",
            },
            "cloud": {
                "status": "online" if self.cloud_available else "not_configured",
                "model": None,
            },
            "usage_today": dict(self.usage_today),
            "budget_remaining_cents": max(0, self.daily_budget_cents - budget_used_cents),
            "routing_stats": dict(self._routing_stats),
        }
