"""
Sprint 14 — Daily Operator Mode.

Generates comprehensive daily briefing with context and priorities.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


class DailyBriefingService:
    """Generates comprehensive daily briefing."""

    CACHE_TTL = 3600  # 1 hour

    def __init__(
        self,
        calendar_service=None,
        email_service=None,
        sqlite_memory=None,
        mission_store=None,
        ollama_service=None,
        deploy_orchestrator=None,
    ):
        self.calendar = calendar_service
        self.email = email_service
        self.memory = sqlite_memory
        self.mission_store = mission_store
        self.ollama = ollama_service
        self.deploy = deploy_orchestrator
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_time: float = 0

    async def generate_briefing(self) -> Dict[str, Any]:
        # Check cache
        if self._cache and time.time() - self._cache_time < self.CACHE_TTL:
            return self._cache

        now = datetime.now(timezone.utc)
        hour = (now.hour - 3) % 24  # BRT approximation

        if hour < 12:
            greeting = "Bom dia, Gregory!"
        elif hour < 18:
            greeting = "Boa tarde, Gregory!"
        else:
            greeting = "Boa noite, Gregory!"

        briefing: Dict[str, Any] = {
            "date": now.strftime("%Y-%m-%d"),
            "greeting": greeting,
            "generated_at": now.isoformat(),
        }

        # Agenda
        if self.calendar:
            try:
                briefing["agenda"] = await self.calendar.get_daily_briefing()
            except Exception:
                briefing["agenda"] = {"events": [], "total": 0, "configured": False}
        else:
            briefing["agenda"] = {"events": [], "total": 0, "configured": False}

        # Emails
        if self.email:
            try:
                briefing["emails"] = await self.email.get_email_briefing()
            except Exception:
                briefing["emails"] = {"unread": [], "unread_count": 0, "configured": False}
        else:
            briefing["emails"] = {"unread": [], "unread_count": 0, "configured": False}

        # Projects
        if self.memory:
            try:
                projects = self.memory.get_all_projects(status="active")
                briefing["projects"] = [
                    {"name": p.get("name", ""), "slug": p.get("slug", ""), "status": p.get("status", ""),
                     "stack": p.get("stack", []), "directory": p.get("directory", "")}
                    for p in projects
                ]
            except Exception:
                briefing["projects"] = []
        else:
            briefing["projects"] = []

        # Pending missions
        if self.mission_store:
            try:
                running = self.mission_store.list_missions(status="running", limit=5)
                paused = self.mission_store.list_missions(status="paused", limit=5)
                briefing["pending"] = {
                    "running": running,
                    "paused": paused,
                    "total": len(running) + len(paused),
                }
            except Exception:
                briefing["pending"] = {"running": [], "paused": [], "total": 0}
        else:
            briefing["pending"] = {"running": [], "paused": [], "total": 0}

        # Focus suggestion
        try:
            briefing["focus_suggestion"] = await self._generate_focus(briefing)
        except Exception:
            briefing["focus_suggestion"] = "Foque no que traz mais impacto hoje."

        self._cache = briefing
        self._cache_time = time.time()
        return briefing

    async def get_focus_priorities(self) -> List[Dict[str, Any]]:
        briefing = await self.generate_briefing()
        priorities: List[Dict[str, Any]] = []

        # Running missions
        for m in briefing.get("pending", {}).get("running", []):
            priorities.append({"priority": "high", "type": "mission", "detail": m.get("objective", ""), "action": "Acompanhar missao ativa"})

        # Paused missions
        for m in briefing.get("pending", {}).get("paused", []):
            priorities.append({"priority": "medium", "type": "mission", "detail": m.get("objective", ""), "action": "Retomar missao pausada"})

        # Active projects
        for p in briefing.get("projects", [])[:3]:
            priorities.append({"priority": "medium", "type": "project", "detail": p.get("name", ""), "action": "Verificar estado do projeto"})

        if not priorities:
            priorities.append({"priority": "low", "type": "general", "detail": "Sem pendencias urgentes", "action": "Revisar proximos passos"})

        return priorities[:10]

    async def get_quick_briefing(self) -> List[Dict[str, Any]]:
        briefing = await self.generate_briefing()
        items: List[Dict[str, Any]] = []

        agenda = briefing.get("agenda", {})
        if agenda.get("configured") and agenda.get("total", 0) > 0:
            items.append({"type": "agenda", "text": f"{agenda['total']} eventos hoje"})

        emails = briefing.get("emails", {})
        if emails.get("configured") and emails.get("unread_count", 0) > 0:
            items.append({"type": "email", "text": f"{emails['unread_count']} emails nao lidos"})

        pending = briefing.get("pending", {})
        if pending.get("total", 0) > 0:
            items.append({"type": "missions", "text": f"{pending['total']} missoes pendentes"})

        projects = briefing.get("projects", [])
        if projects:
            items.append({"type": "projects", "text": f"{len(projects)} projetos ativos"})

        if not items:
            items.append({"type": "status", "text": "Tudo em ordem!"})

        return items[:5]

    async def _generate_focus(self, briefing: Dict[str, Any]) -> str:
        if not self.ollama:
            return "Foque no que traz mais impacto hoje."
        try:
            context_parts = []
            if briefing.get("agenda", {}).get("total", 0) > 0:
                context_parts.append(f"{briefing['agenda']['total']} eventos na agenda")
            if briefing.get("emails", {}).get("unread_count", 0) > 0:
                context_parts.append(f"{briefing['emails']['unread_count']} emails nao lidos")
            if briefing.get("pending", {}).get("total", 0) > 0:
                context_parts.append(f"{briefing['pending']['total']} missoes pendentes")
            projects_text = ", ".join(p.get("name", "") for p in briefing.get("projects", [])[:3])
            if projects_text:
                context_parts.append(f"Projetos ativos: {projects_text}")

            prompt = (
                f"Gregory e um engenheiro e maquinista. Com base no contexto abaixo, "
                f"sugira em 2 frases o que ele deveria focar hoje:\n"
                f"{'|'.join(context_parts)}"
            )
            text, _ = await self.ollama.generate_response(prompt, [], think=False)
            return text[:300]
        except Exception:
            return "Foque no que traz mais impacto hoje."

    def invalidate_cache(self) -> None:
        self._cache = None
        self._cache_time = 0
