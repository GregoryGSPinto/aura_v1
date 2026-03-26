"""
Sprint 13.5 — Proactive Agent Engine.

Background monitoring, opinion engine, and personality for Aura.
"""

import asyncio
import logging
import time
import uuid
from collections import deque
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Personality ─────────────────────────────────────────────────


PERSONALITY_TRAITS = {
    "directness": 0.9,
    "proactivity": 0.85,
    "humor": 0.3,
    "empathy": 0.7,
    "assertiveness": 0.8,
    "formality": 0.2,
    "technical_depth": 0.8,
}

RESPONSE_PATTERNS = {
    "opinion_request": "Olha, na minha visao: {opinion}. {reason}",
    "task_done": "Pronto. {result} {next_suggestion}",
    "problem_detected": "Detectei um problema: {problem}. Sugestao: {suggestion}",
    "late_night": "Gregory, ja passa das {time}. {suggestion}",
    "scope_creep": "Hmm, isso esta adicionando escopo. O foco original era: {original}. Quer realmente expandir?",
    "greeting_morning": "Bom dia, Gregory! {briefing}",
    "greeting_afternoon": "Boa tarde! {context}",
    "greeting_night": "Boa noite! {status}",
}

SYSTEM_PROMPT_INJECTION = """
## Diretrizes da Aura (Personalidade)
- Seja direta: nao diga "claro", "com certeza", va direto ao ponto
- Tenha opiniao: nao diga "depende", de uma recomendacao clara
- Seja proativa: antecipe necessidades, sugira proximos passos
- Questione scope creep: se o Gregory pedir algo fora do escopo, questione gentilmente
- Cuide do horario: apos 22h, sugira descanso se ele estiver trabalhando
- Sugira proximos passos apos completar uma tarefa
- Detecte e reporte problemas automaticamente
"""


# ── Alert Model ─────────────────────────────────────────────────


class ProactiveAlert:
    def __init__(
        self,
        alert_type: str,
        message: str,
        suggestion: str = "",
        severity: str = "info",
        project: str = "",
        data: Optional[Dict[str, Any]] = None,
        actionable: bool = False,
    ):
        self.id = str(uuid.uuid4())
        self.type = alert_type
        self.message = message
        self.suggestion = suggestion
        self.severity = severity
        self.project = project
        self.data = data or {}
        self.actionable = actionable
        self.created_at = time.time()
        self.dismissed = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "message": self.message,
            "suggestion": self.suggestion,
            "severity": self.severity,
            "project": self.project,
            "data": self.data,
            "actionable": self.actionable,
            "created_at": self.created_at,
            "dismissed": self.dismissed,
        }


# ── Background Monitor ─────────────────────────────────────────


class BackgroundMonitor:
    """Continuous monitoring service that detects issues and opportunities."""

    def __init__(self):
        self.alerts: deque = deque(maxlen=100)
        self.cooldowns: Dict[str, float] = {}
        self._running = False
        self._tasks: List[asyncio.Task] = []

    def add_alert(self, alert: ProactiveAlert, cooldown_seconds: int = 300) -> bool:
        """Add alert with deduplication cooldown."""
        cooldown_key = f"{alert.type}:{alert.project}"
        now = time.time()
        if cooldown_key in self.cooldowns and now - self.cooldowns[cooldown_key] < cooldown_seconds:
            return False
        self.cooldowns[cooldown_key] = now
        self.alerts.appendleft(alert)
        self._broadcast_alert(alert)
        return True

    def get_alerts(self, limit: int = 20, severity: Optional[str] = None) -> List[Dict[str, Any]]:
        alerts = [a for a in self.alerts if not a.dismissed]
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        return [a.to_dict() for a in alerts[:limit]]

    def dismiss_alert(self, alert_id: str) -> bool:
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.dismissed = True
                return True
        return False

    def _broadcast_alert(self, alert: ProactiveAlert) -> None:
        try:
            from app.services.websocket_manager import ws_manager
            asyncio.get_event_loop().create_task(
                ws_manager.broadcast({
                    "type": "proactive.alert",
                    "alert": alert.to_dict(),
                })
            )
        except Exception:
            pass

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        logger.info("[BackgroundMonitor] Started")

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()
        logger.info("[BackgroundMonitor] Stopped")


# ── Opinion Engine ──────────────────────────────────────────────


class OpinionEngine:
    """Generates opinionated responses and suggestions."""

    def __init__(self, ollama_service=None, claude_client=None):
        self.ollama = ollama_service
        self.claude = claude_client

    async def get_opinion(self, topic: str, context: str = "") -> Dict[str, Any]:
        prompt = (
            f"Voce e a Aura, assistente AI opinativa e direta. "
            f"De sua opiniao sobre: {topic}\n"
            f"{'Contexto: ' + context if context else ''}\n"
            f"Seja direta, de uma recomendacao clara, sem 'depende'."
        )
        try:
            if self.ollama:
                text, _ = await self.ollama.generate_response(prompt, [], think=False)
                return {"opinion": text, "source": "ollama"}
        except Exception as exc:
            logger.warning("[OpinionEngine] Failed: %s", exc)
        return {"opinion": "Nao consegui gerar uma opiniao no momento.", "source": "fallback"}

    async def analyze_and_suggest(self, situation: str, project_slug: str = "") -> List[Dict[str, Any]]:
        prompt = (
            f"Analise a situacao e sugira 1-3 acoes concretas:\n"
            f"Situacao: {situation}\n"
            f"{'Projeto: ' + project_slug if project_slug else ''}\n"
            f"Responda com sugestoes praticas e diretas."
        )
        try:
            if self.ollama:
                text, _ = await self.ollama.generate_response(prompt, [], think=False)
                return [{"suggestion": text, "source": "ollama"}]
        except Exception:
            pass
        return [{"suggestion": "Analise a situacao manualmente.", "source": "fallback"}]

    async def daily_insight(self) -> str:
        try:
            if self.ollama:
                text, _ = await self.ollama.generate_response(
                    "Gere um insight curto e util sobre produtividade em desenvolvimento de software. "
                    "Maximo 2 frases, direto ao ponto.",
                    [], think=False,
                )
                return text
        except Exception:
            pass
        return "Foque no que traz mais impacto. Menos features, mais qualidade."


# ── Proactive Service (Facade) ──────────────────────────────────


class ProactiveEngine:
    """Facade combining monitor, opinion engine, and personality."""

    def __init__(self, ollama_service=None, claude_client=None):
        self.monitor = BackgroundMonitor()
        self.opinion = OpinionEngine(ollama_service, claude_client)
        self.personality = PERSONALITY_TRAITS.copy()

    async def start(self) -> None:
        await self.monitor.start()

    async def stop(self) -> None:
        await self.monitor.stop()

    def get_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.monitor.get_alerts(limit=limit)

    def dismiss_alert(self, alert_id: str) -> bool:
        return self.monitor.dismiss_alert(alert_id)

    async def get_opinion(self, topic: str, context: str = "") -> Dict[str, Any]:
        return await self.opinion.get_opinion(topic, context)

    async def get_suggestions(self) -> List[Dict[str, Any]]:
        return await self.opinion.analyze_and_suggest("Estado geral dos projetos")

    async def get_insight(self) -> str:
        return await self.opinion.daily_insight()

    def get_system_prompt_injection(self) -> str:
        return SYSTEM_PROMPT_INJECTION
