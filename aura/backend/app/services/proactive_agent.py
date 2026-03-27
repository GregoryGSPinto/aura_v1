"""
Proactive Agent — Monitora e age em background.

Rotinas:
1. Greeting contextual quando Gregory abre o chat
2. Health Monitor: a cada 5 minutos
3. Git Watcher: detecta mudancas pendentes
4. Idle Check: se Gregory nao interage ha 2h

Entrega via:
- Mensagem proativa no chat (quando Gregory abre)
- Banner no topo da interface
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


class ProactiveAgent:
    def __init__(self, memory, agent_service=None, ollama_lifecycle=None):
        self.memory = memory
        self.agent = agent_service
        self.ollama = ollama_lifecycle
        self.last_greeting: Optional[datetime] = None
        self.pending_alerts: List[Dict[str, Any]] = []
        self._running = False

    async def start(self) -> None:
        """Inicia loop de monitoramento em background."""
        if self._running:
            return
        self._running = True
        asyncio.ensure_future(self._monitor_loop())
        logger.info("[ProactiveAgent] Background monitor started")

    async def stop(self) -> None:
        self._running = False
        logger.info("[ProactiveAgent] Stopped")

    async def _monitor_loop(self) -> None:
        while self._running:
            try:
                await self._check_health()
                await self._check_git_status()
            except Exception as e:
                logger.error("[ProactiveAgent] Monitor error: %s", e)
            await asyncio.sleep(300)  # A cada 5 minutos

    async def get_greeting(self) -> Optional[str]:
        """
        Gera saudacao contextual quando Gregory abre o chat.
        Chamado pelo frontend ao carregar.
        """
        now = datetime.now()

        # Ja cumprimentou hoje?
        if self.last_greeting and self.last_greeting.date() == now.date():
            if self.pending_alerts:
                return self._format_alerts()
            return None

        self.last_greeting = now

        # Saudacao por horario
        hour = now.hour
        if 5 <= hour < 12:
            greeting = "Bom dia, Gregory."
        elif 12 <= hour < 18:
            greeting = "Boa tarde, Gregory."
        else:
            greeting = "Boa noite, Gregory."

        parts = [greeting]

        # Buscar projetos ativos
        try:
            projects = await self.memory.list_projects()
            active_projects = [p for p in projects if p.get("status") == "active"]

            # Git status dos projetos ativos
            pending_changes = []
            for project in active_projects[:3]:
                root = project.get("directory") or project.get("root_path")
                if not root:
                    continue
                try:
                    expanded = os.path.expanduser(root)
                    if not os.path.isdir(expanded):
                        continue
                    proc = await asyncio.create_subprocess_shell(
                        f"cd {expanded} && git status --porcelain 2>/dev/null | wc -l",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
                    count = int(stdout.decode().strip())
                    if count > 0:
                        pending_changes.append(f"{project.get('name', project.get('slug', '?'))}: {count} arquivos pendentes")
                except Exception:
                    pass

            if pending_changes:
                parts.append(f"\n📝 Pendências: {', '.join(pending_changes)}")

        except Exception:
            pass

        # Alertas pendentes
        if self.pending_alerts:
            parts.append(f"\n⚠️ {len(self.pending_alerts)} alerta(s)")

        # Fatos recentes / next steps
        try:
            facts = await self.memory.get_facts(project_id="aura", limit=5)
            if facts:
                next_steps = [f for f in facts if f.get("fact_type") == "next_step"]
                if next_steps:
                    parts.append(f"\n💡 Próximo passo: {next_steps[0]['content'][:100]}")
        except Exception:
            pass

        # Horario noturno
        if hour >= 21:
            parts.append("\n🌙 Está tarde. Precisa de algo rápido ou encerramos por hoje?")

        return "\n".join(parts)

    async def _check_health(self) -> None:
        """Monitora saude do sistema."""
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory().percent
            disk = psutil.disk_usage("/").percent

            if cpu > 85:
                self._add_alert("high", f"CPU em {cpu}% — considere fechar apps pesados")
            if ram > 90:
                self._add_alert("high", f"RAM em {ram}% — Ollama pode estar consumindo demais")
            if disk > 95:
                self._add_alert("critical", f"Disco em {disk}% — limpe espaço urgente")
        except ImportError:
            pass

    async def _check_git_status(self) -> None:
        """Verifica se tem mudancas nao commitadas nos projetos."""
        try:
            projects = await self.memory.list_projects()
        except Exception:
            return

        for project in projects:
            root = project.get("directory") or project.get("root_path")
            if not root:
                continue
            try:
                expanded = os.path.expanduser(root)
                if not os.path.isdir(expanded):
                    continue
                proc = await asyncio.create_subprocess_shell(
                    f"cd {expanded} && git diff --stat HEAD 2>/dev/null | tail -1",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
                output = stdout.decode().strip()
                if "files changed" in output:
                    name = project.get("name", project.get("slug", "?"))
                    self._add_alert("info", f"{name}: {output}")
            except Exception:
                pass

    def _add_alert(self, severity: str, message: str) -> None:
        if not any(a["message"] == message for a in self.pending_alerts):
            self.pending_alerts.append({
                "severity": severity,
                "message": message,
                "timestamp": datetime.now().isoformat(),
            })

    def _format_alerts(self) -> str:
        if not self.pending_alerts:
            return ""
        lines = ["⚠️ Alertas:"]
        emoji_map = {"info": "ℹ️", "low": "📋", "medium": "🟡", "high": "🟠", "critical": "🔴"}
        for alert in self.pending_alerts[:5]:
            emoji = emoji_map.get(alert["severity"], "⚠️")
            lines.append(f"  {emoji} {alert['message']}")
        return "\n".join(lines)

    def get_pending_alerts(self) -> List[Dict[str, Any]]:
        return self.pending_alerts

    def dismiss_alert(self, index: int) -> bool:
        if 0 <= index < len(self.pending_alerts):
            self.pending_alerts.pop(index)
            return True
        return False
