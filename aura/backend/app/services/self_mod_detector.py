"""
Self-Modification Detector — Identifica pedidos de auto-modificação.

Quando Gregory diz algo como:
- "adiciona uma tool de email"
- "muda o timeout do Ollama pra 5 minutos"
- "cria um endpoint novo no backend"
- "atualiza o design da sidebar"
- "melhora o prompt do agent"
- "se atualiza pra fazer X"

...o detector classifica como AUTO-MODIFICAÇÃO.

Auto-modificação = qualquer alteração em:
- backend/app/ (qualquer arquivo Python da Aura)
- frontend/components/ (qualquer componente React)
- frontend/lib/ (stores, api, utils)
- frontend/app/ (páginas)
- scripts/ (scripts de boot/deploy)
- CLAUDE.md, .env (configuração)

NÃO é auto-modificação:
- Trabalhar em OUTROS projetos (Black Belt, Rail360)
- Criar arquivos em ~/Projetos/outro_projeto/
- Operações de leitura (git status, ls, cat)
- Pesquisa e análise
"""

import re
import logging
from typing import List
from dataclasses import dataclass

logger = logging.getLogger("aura")


# Paths que são "a Aura"
AURA_PATHS = [
    "aura/backend/",
    "aura/frontend/",
    "aura_v1/aura/",
    "scripts/",
    "CLAUDE.md",
    ".env",
    "backend/app/",
    "frontend/components/",
    "frontend/lib/",
    "frontend/app/",
]

# Patterns que indicam pedido de auto-modificação (PT + EN)
SELF_MOD_PATTERNS = [
    # Português
    r"\b(adiciona|cria|implementa|faz|coloca|bota|mete)\b.*\b(tool|ferramenta|endpoint|rota|componente|tela|página|serviço|service)\b",
    r"\b(muda|altera|modifica|atualiza|melhora|refatora|corrige|arruma|conserta)\b.*\b(seu|teu|da aura|do backend|do frontend|no código|na aura)\b",
    r"\b(se\s+atualiza|se\s+modifica|se\s+melhora|se\s+expande)\b",
    r"\b(novo|nova)\s+(tool|endpoint|componente|serviço|funcionalidade|feature)\b",
    r"\b(remove|deleta|tira)\b.*\b(tool|endpoint|componente)\b.*\b(da aura|do backend|do frontend)\b",
    r"\bauto[\s-]?(modifica|atualiza|expande|melhora)\b",
    r"\b(evolui|evolua|upgrade)\b.*\b(aura|backend|frontend)\b",
    r"\b(adiciona|implementa)\b.*\b(na|no|pra)\s+(aura|backend|frontend|chat)\b",
    r"\b(muda|troca|configura)\b.*\b(timeout|porta|modelo|prompt|comportamento)\b.*\b(da aura|do backend|do ollama)\b",
    # English
    r"\b(add|create|implement|build)\b.*\b(tool|endpoint|route|component|service|feature)\b.*\b(to aura|in aura|for aura)\b",
    r"\b(modify|change|update|improve|refactor|fix)\b.*\b(your|aura|backend|frontend)\b",
    r"\bself[\s-]?(modify|update|improve|expand)\b",
]

# Patterns de LEITURA (NÃO são auto-modificação)
READ_ONLY_PATTERNS = [
    r"\b(mostra|lista|veja|leia|analisa|verifica|checa)\b",
    r"\b(git\s+status|git\s+log|git\s+diff)\b",
    r"\b(ls|cat|head|tail|grep|find)\b",
    r"\b(quantos?|qual|como\s+está|o\s+que\s+tem)\b",
]


@dataclass
class SelfModAnalysis:
    is_self_modification: bool
    confidence: float  # 0.0 a 1.0
    affected_areas: List[str]  # ["backend/tools", "frontend/components"]
    description: str  # Resumo legível do que seria modificado
    risk_level: str  # "low", "medium", "high"
    requires_restart: bool  # Se precisa reiniciar o backend


def detect_self_modification(message: str) -> SelfModAnalysis:
    """
    Analisa se a mensagem do Gregory pede auto-modificação da Aura.

    Retorna SelfModAnalysis com detalhes do que seria afetado.
    """
    message_lower = message.lower().strip()

    # Primeiro: é read-only? Se sim, não é auto-mod
    for pattern in READ_ONLY_PATTERNS:
        if re.search(pattern, message_lower):
            # Pode ser read-only, mas verifica se também tem mod patterns
            has_mod = any(re.search(p, message_lower) for p in SELF_MOD_PATTERNS)
            if not has_mod:
                return SelfModAnalysis(
                    is_self_modification=False,
                    confidence=0.9,
                    affected_areas=[],
                    description="Operação de leitura",
                    risk_level="low",
                    requires_restart=False,
                )

    # Verificar patterns de auto-modificação
    matches = []
    for pattern in SELF_MOD_PATTERNS:
        if re.search(pattern, message_lower):
            matches.append(pattern)

    if not matches:
        return SelfModAnalysis(
            is_self_modification=False,
            confidence=0.7,
            affected_areas=[],
            description="Não identificado como auto-modificação",
            risk_level="low",
            requires_restart=False,
        )

    # É auto-modificação — analisar o que seria afetado
    affected = []
    requires_restart = False
    risk = "low"

    # Detectar áreas afetadas
    backend_keywords = ["backend", "endpoint", "rota", "serviço", "service", "tool", "ferramenta",
                        "api", "python", "fastapi", "ollama", "timeout", "modelo", "prompt"]
    frontend_keywords = ["frontend", "componente", "tela", "página", "design", "sidebar",
                         "chat", "botão", "input", "visual", "ui", "css", "tailwind"]
    infra_keywords = ["script", "boot", "deploy", "vercel", "ngrok", "launchagent",
                      ".env", "configuração", "config", "porta"]

    for kw in backend_keywords:
        if kw in message_lower:
            affected.append("backend")
            requires_restart = True
            break

    for kw in frontend_keywords:
        if kw in message_lower:
            affected.append("frontend")
            break

    for kw in infra_keywords:
        if kw in message_lower:
            affected.append("infra")
            risk = "medium"
            break

    if not affected:
        affected = ["backend"]  # default se não conseguiu detectar
        requires_restart = True

    # Avaliar risco
    high_risk_keywords = ["delete", "remove", "deleta", ".env", "token", "auth",
                          "segurança", "security", "senha", "password", "force"]
    if any(kw in message_lower for kw in high_risk_keywords):
        risk = "high"

    # Gerar descrição
    if "tool" in message_lower or "ferramenta" in message_lower:
        desc = "Criar/modificar tool no backend"
    elif "endpoint" in message_lower or "rota" in message_lower:
        desc = "Criar/modificar endpoint da API"
    elif "componente" in message_lower or "tela" in message_lower:
        desc = "Criar/modificar componente do frontend"
    elif "design" in message_lower or "visual" in message_lower:
        desc = "Modificar aparência do frontend"
    elif "config" in message_lower or "timeout" in message_lower:
        desc = "Alterar configuração do sistema"
    else:
        desc = "Modificar código da Aura"

    confidence = min(0.5 + (len(matches) * 0.15), 0.95)

    logger.info(f"[SelfMod] Detectado: {desc} | Áreas: {affected} | Risco: {risk} | Confiança: {confidence}")

    return SelfModAnalysis(
        is_self_modification=True,
        confidence=confidence,
        affected_areas=affected,
        description=desc,
        risk_level=risk,
        requires_restart=requires_restart,
    )
