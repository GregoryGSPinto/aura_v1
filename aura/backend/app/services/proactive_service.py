"""
Proactive Service — Aura faz coisas sozinha.
"""

import asyncio
import logging
from datetime import datetime, time
from typing import Optional

logger = logging.getLogger("aura")


class ProactiveService:

    def __init__(self, scheduler=None, ollama_service=None, memory_service=None, persistence=None,
                 github=None, calendar=None, gmail=None):
        self.scheduler = scheduler
        self.ollama = ollama_service
        self.memory = memory_service
        self.persistence = persistence
        self.github = github
        self.calendar = calendar
        self.gmail = gmail
        self._routines: list = []
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_run: dict = {}

    async def start(self):
        if self._running:
            return
        self._running = True
        self._register_default_routines()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("[ProactiveService] Started with %d routines", len(self._routines))

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    def _register_default_routines(self):
        self._routines = [
            {"name": "morning_briefing", "description": "Resumo matinal", "schedule": {"hour": 8, "minute": 0}, "handler": self._morning_briefing, "enabled": True},
            {"name": "system_health", "description": "Check de saúde", "schedule": {"interval_minutes": 60}, "handler": self._system_health_check, "enabled": True},
        ]

    async def _run_loop(self):
        while self._running:
            try:
                now = datetime.now()
                for routine in self._routines:
                    if not routine["enabled"]:
                        continue
                    if self._should_run(routine, now):
                        key = routine["name"]
                        last = self._last_run.get(key)
                        if last and (now - last).total_seconds() < 55:
                            continue
                        self._last_run[key] = now
                        logger.info("[ProactiveService] Running: %s", key)
                        try:
                            result = await routine["handler"]()
                            self._save_result(key, result)
                        except Exception as exc:
                            logger.error("[ProactiveService] %s failed: %s", key, exc)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("[ProactiveService] Loop error: %s", exc)
            await asyncio.sleep(60)

    def _should_run(self, routine: dict, now: datetime) -> bool:
        schedule = routine["schedule"]
        if "hour" in schedule:
            return now.hour == schedule["hour"] and now.minute == schedule.get("minute", 0)
        if "interval_minutes" in schedule:
            return now.minute % schedule["interval_minutes"] == 0
        return False

    async def _morning_briefing(self) -> dict:
        sections = []
        if self.github:
            try:
                configured = await self.github.is_configured()
                if configured:
                    sync = await self.github.sync()
                    sections.append(f"GitHub: {sync.get('summary', '')}")
            except Exception:
                pass
        if self.calendar:
            try:
                configured = await self.calendar.is_configured()
                if configured:
                    sync = await self.calendar.sync()
                    sections.append(f"Agenda: {sync.get('summary', '')}")
            except Exception:
                pass
        if self.gmail:
            try:
                configured = await self.gmail.is_configured()
                if configured:
                    sync = await self.gmail.sync()
                    sections.append(f"Email: {sync.get('summary', '')}")
            except Exception:
                pass
        knowledge = []
        if self.memory:
            try:
                mem = self.memory.get_companion_memory()
                knowledge = mem.get("recent_context", [])[:10]
            except Exception:
                pass
        content = "Briefing matinal:\n" + "\n".join(sections) if sections else "Sem dados de conectores configurados."
        return {"type": "morning_briefing", "content": content, "sources": sections}

    async def _system_health_check(self) -> dict:
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            alerts = []
            if cpu > 80:
                alerts.append(f"CPU alta: {cpu}%")
            if ram.percent > 85:
                alerts.append(f"RAM alta: {ram.percent}%")
            if disk.percent > 90:
                alerts.append(f"Disco quase cheio: {disk.percent}%")
            return {"type": "health_check", "cpu_percent": cpu, "ram_percent": ram.percent, "disk_percent": disk.percent, "alerts": alerts}
        except ImportError:
            return {"type": "health_check", "alerts": ["psutil not installed"]}

    def _save_result(self, routine_name: str, result: dict):
        try:
            if self.persistence and hasattr(self.persistence, "append_audit_log"):
                from app.models.persistence_models import AuditLogEntry
                self.persistence.append_audit_log(
                    AuditLogEntry(action=f"routine:{routine_name}", status="completed", actor="proactive", details={"result": str(result)[:500]})
                )
        except Exception:
            pass

    async def get_pending_notifications(self) -> list:
        return []
