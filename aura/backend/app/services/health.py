"""
AURA Health Registry — centralised health-check for every subsystem.

Usage:
    from app.services.health import health_registry
    await health_registry.boot_check()
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import psutil

from app.core.config import Settings


# ── Data helpers ────────────────────────────────────────────────────────────

_STATUS_EMOJI = {
    "online": "\u2705",
    "offline": "\u274c",
    "degraded": "\u26a0\ufe0f",
    "unknown": "\u274c",
    "not_configured": "\u26a0\ufe0f",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Service state ───────────────────────────────────────────────────────────

class ServiceState:
    """Mutable snapshot for a single service."""

    __slots__ = (
        "name",
        "status",
        "last_check",
        "last_error",
        "action",
        "latency_ms",
        "extra",
    )

    def __init__(self, name: str) -> None:
        self.name: str = name
        self.status: str = "unknown"
        self.last_check: str = _now_iso()
        self.last_error: Optional[str] = None
        self.action: Optional[str] = None
        self.latency_ms: Optional[float] = None
        self.extra: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "last_check": self.last_check,
            "last_error": self.last_error,
            "action": self.action,
            "latency_ms": self.latency_ms,
            "extra": self.extra,
        }


# ── Health Registry (singleton) ────────────────────────────────────────────

class HealthRegistry:
    """Manages health checks for every Aura subsystem."""

    _CORE_SERVICES = {"ollama", "modelo"}

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._services: Dict[str, ServiceState] = {}
        self._checks: Dict[str, Any] = {}  # name -> async callable
        self._bg_task: Optional[asyncio.Task] = None

        # Register built-in checks
        self._register_builtin_checks()

    # ── Registration ────────────────────────────────────────────────────

    def _register(self, name: str, check_fn) -> None:
        self._services[name] = ServiceState(name)
        self._checks[name] = check_fn

    def _register_builtin_checks(self) -> None:
        self._register("ollama", self._check_ollama)
        self._register("modelo", self._check_modelo)
        self._register("backend_self", self._check_backend_self)
        self._register("voice_runtime", self._check_voice_runtime)
        self._register("browser_runtime", self._check_browser_runtime)
        self._register("claude_bridge", self._check_claude_bridge)
        self._register("terminal_bridge", self._check_terminal_bridge)
        self._register("ngrok_tunnel", self._check_ngrok_tunnel)

    # ── Public API ──────────────────────────────────────────────────────

    async def check_all(self) -> Dict[str, Dict[str, Any]]:
        """Run ALL health checks in parallel (each with 5 s timeout)."""
        names = list(self._checks.keys())
        tasks = [self._run_single(n) for n in names]
        await asyncio.gather(*tasks, return_exceptions=True)
        return self.get_all()

    async def check_service(self, name: str) -> Dict[str, Any]:
        """Run a single health check by service name."""
        if name not in self._checks:
            raise KeyError(f"Unknown service: {name}")
        await self._run_single(name)
        return self._services[name].to_dict()

    def get_all(self) -> Dict[str, Dict[str, Any]]:
        """Return current state of every registered service."""
        return {name: svc.to_dict() for name, svc in self._services.items()}

    def get_overall_status(self) -> str:
        """
        healthy   — all core services online
        degraded  — some non-core services offline but core works
        unhealthy — ollama or modelo is offline/unknown
        """
        core_ok = all(
            self._services[n].status == "online"
            for n in self._CORE_SERVICES
            if n in self._services
        )
        if not core_ok:
            return "unhealthy"

        all_ok = all(
            svc.status in ("online", "not_configured")
            for svc in self._services.values()
        )
        return "healthy" if all_ok else "degraded"

    # ── Background loop ─────────────────────────────────────────────────

    async def start_background(self, interval: int = 30) -> None:
        """Start a background task that runs check_all() every *interval* seconds."""
        if self._bg_task is not None and not self._bg_task.done():
            return  # already running
        self._bg_task = asyncio.create_task(self._background_loop(interval))

    async def stop_background(self) -> None:
        """Cancel the background health-check task."""
        if self._bg_task is not None and not self._bg_task.done():
            self._bg_task.cancel()
            try:
                await self._bg_task
            except asyncio.CancelledError:
                pass
            self._bg_task = None

    async def _background_loop(self, interval: int) -> None:
        while True:
            try:
                await self.check_all()
            except Exception:
                pass  # individual failures already captured per-service
            await asyncio.sleep(interval)

    # ── Boot banner ─────────────────────────────────────────────────────

    async def boot_check(self) -> None:
        """Run check_all() once and print a formatted boot banner."""
        await self.check_all()

        width = 40
        sep = "\u2550" * width
        border_tl = "\u2554"
        border_tr = "\u2557"
        border_bl = "\u255a"
        border_br = "\u255d"
        border_ml = "\u2560"
        border_mr = "\u2563"
        vbar = "\u2551"

        title = "AURA \u2014 System Boot Check"
        title_padded = title.center(width)

        lines: List[str] = []
        lines.append(f"{border_tl}{sep}{border_tr}")
        lines.append(f"{vbar}{title_padded}{vbar}")
        lines.append(f"{border_ml}{sep}{border_mr}")

        for svc in self._services.values():
            emoji = _STATUS_EMOJI.get(svc.status, "\u274c")
            latency_str = f" ({svc.latency_ms:.0f}ms)" if svc.latency_ms is not None else ""

            # Build the label shown after the emoji
            if svc.name == "modelo" and svc.status == "online":
                detail = svc.extra.get("model", svc.status)
            else:
                detail = svc.status

            entry = f" {svc.name:<16}{emoji} {detail}{latency_str}"
            lines.append(f"{vbar}{entry:<{width}}{vbar}")

        overall = self.get_overall_status().upper()
        status_line = f" Status: {overall}"
        lines.append(f"{border_ml}{sep}{border_mr}")
        lines.append(f"{vbar}{status_line:<{width}}{vbar}")
        lines.append(f"{border_bl}{sep}{border_br}")

        print("\n".join(lines))

    # ── Internal runner ─────────────────────────────────────────────────

    async def _run_single(self, name: str) -> None:
        svc = self._services[name]
        check_fn = self._checks[name]
        old_status = svc.status
        t0 = time.monotonic()
        try:
            await asyncio.wait_for(check_fn(svc), timeout=5.0)
        except asyncio.TimeoutError:
            svc.status = "offline"
            svc.last_error = "Health check timed out (5 s)"
            svc.action = None
        except Exception as exc:
            svc.status = "offline"
            svc.last_error = str(exc)
            svc.action = None
        finally:
            svc.latency_ms = round((time.monotonic() - t0) * 1000, 1)
            svc.last_check = _now_iso()

        # Emit health.changed via WebSocket if status transitioned
        if old_status != svc.status and old_status != "unknown":
            try:
                from app.services.events import AuraEvent
                from app.services.websocket_manager import ws_manager
                await ws_manager.broadcast(
                    AuraEvent.health_changed(name, old_status, svc.status)
                )
            except Exception:
                pass  # WS broadcast is best-effort

    # ── Individual checks ───────────────────────────────────────────────

    async def _check_ollama(self, svc: ServiceState) -> None:
        url = f"{self.settings.ollama_url}/api/tags"
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                svc.status = "online"
                svc.last_error = None
                svc.action = None
                svc.extra = {"models": models}
            except (httpx.HTTPError, httpx.ConnectError, Exception) as exc:
                svc.status = "offline"
                svc.last_error = str(exc)
                svc.action = "Execute: ollama serve"
                svc.extra = {}

    async def _check_modelo(self, svc: ServiceState) -> None:
        # Depends on Ollama data — read from the ollama service state
        ollama_svc = self._services.get("ollama")
        model_name = self.settings.model_name

        # If Ollama is offline we cannot determine model availability
        if ollama_svc is None or ollama_svc.status != "online":
            # Try fetching directly in case check order varies
            url = f"{self.settings.ollama_url}/api/tags"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    models = [m.get("name", "") for m in resp.json().get("models", [])]
            except Exception:
                svc.status = "offline"
                svc.last_error = "Ollama indisponível — impossível verificar modelo"
                svc.action = "Execute: ollama serve"
                svc.extra = {}
                return
        else:
            models = ollama_svc.extra.get("models", [])

        # Normalize: Ollama returns names like "qwen3.5:9b" — match with or without tag
        found = any(
            model_name == m or model_name == m.split(":")[0]
            for m in models
        )

        if found:
            svc.status = "online"
            svc.last_error = None
            svc.action = None
            svc.extra = {"model": model_name}
        else:
            svc.status = "offline"
            svc.last_error = f"Modelo '{model_name}' não encontrado na lista Ollama"
            svc.action = f"Execute: ollama pull {model_name}"
            svc.extra = {"available_models": models}

    async def _check_backend_self(self, svc: ServiceState) -> None:
        cpu_pct = psutil.cpu_percent(interval=0)
        mem = psutil.virtual_memory()
        svc.status = "online"
        svc.last_error = None
        svc.action = None
        svc.extra = {
            "cpu_percent": cpu_pct,
            "memory_percent": mem.percent,
            "memory_used_mb": round(mem.used / (1024 * 1024), 1),
            "memory_total_mb": round(mem.total / (1024 * 1024), 1),
        }

    async def _check_voice_runtime(self, svc: ServiceState) -> None:
        svc.status = "not_configured"
        svc.last_error = None
        svc.action = "Voice não configurado ainda"
        svc.extra = {}

    async def _check_browser_runtime(self, svc: ServiceState) -> None:
        svc.status = "not_configured"
        svc.last_error = None
        svc.action = "Browser runtime não configurado ainda"
        svc.extra = {}

    async def _check_claude_bridge(self, svc: ServiceState) -> None:
        try:
            proc = await asyncio.create_subprocess_exec(
                "which", "claude",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0 and stdout.strip():
                svc.status = "online"
                svc.last_error = None
                svc.action = None
                svc.extra = {"path": stdout.decode().strip()}
            else:
                svc.status = "offline"
                svc.last_error = "claude CLI não encontrado no PATH"
                svc.action = "Instale Claude Code: npm install -g @anthropic-ai/claude-code"
                svc.extra = {}
        except Exception as exc:
            svc.status = "offline"
            svc.last_error = str(exc)
            svc.action = "Instale Claude Code: npm install -g @anthropic-ai/claude-code"
            svc.extra = {}

    async def _check_terminal_bridge(self, svc: ServiceState) -> None:
        try:
            proc = await asyncio.create_subprocess_exec(
                "echo", "test",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                svc.status = "online"
                svc.last_error = None
                svc.action = None
                svc.extra = {}
            else:
                svc.status = "offline"
                svc.last_error = "echo test retornou código diferente de zero"
                svc.action = None
                svc.extra = {}
        except Exception as exc:
            svc.status = "offline"
            svc.last_error = str(exc)
            svc.action = None
            svc.extra = {}

    async def _check_ngrok_tunnel(self, svc: ServiceState) -> None:
        url = "http://127.0.0.1:4040/api/tunnels"
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                tunnels = data.get("tunnels", [])
                tunnel_urls = [t.get("public_url", "") for t in tunnels]
                svc.status = "online"
                svc.last_error = None
                svc.action = None
                svc.extra = {"tunnels": tunnel_urls}
            except (httpx.HTTPError, httpx.ConnectError, Exception):
                svc.status = "offline"
                svc.last_error = "ngrok não está em execução ou API local indisponível"
                svc.action = "Execute o script de boot ou inicie ngrok manualmente"
                svc.extra = {}


# ── Module-level singleton ──────────────────────────────────────────────────

def _build_registry() -> HealthRegistry:
    from app.core.config import get_settings
    return HealthRegistry(settings=get_settings())


# Lazy singleton — instantiated on first import so Settings env vars are loaded.
health_registry: HealthRegistry = _build_registry()
