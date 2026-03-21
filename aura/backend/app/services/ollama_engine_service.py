"""
Ollama Engine Service — Controle de ignicao do modelo local.

Comandos reais que o Mac executa:
- START: ollama serve (inicia o servidor Ollama em background)
- STOP: ollama stop (para o modelo) + pkill ollama (mata o processo)
- STATUS: verifica se o processo esta rodando + se responde a requests
"""

import asyncio
import logging
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger("aura")


class EngineStatus(str, Enum):
    RUNNING = "running"
    STARTING = "starting"
    STOPPED = "stopped"
    STOPPING = "stopping"
    ERROR = "error"


class OllamaEngineService:
    """Controla o ciclo de vida do Ollama no Mac."""

    def __init__(self, ollama_url: str = "http://localhost:11434", model_name: str = "qwen3.5:9b"):
        self.ollama_url = ollama_url
        self.model_name = model_name
        self._status = EngineStatus.STOPPED
        self._process: Optional[asyncio.subprocess.Process] = None

    async def start(self) -> dict:
        """Liga o motor Ollama."""
        if await self._is_ollama_running():
            self._status = EngineStatus.RUNNING
            return {"status": "running", "message": "Ollama ja esta rodando."}

        self._status = EngineStatus.STARTING
        logger.info("[OllamaEngine] Starting ollama serve...")

        try:
            self._process = await asyncio.create_subprocess_exec(
                "ollama", "serve",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )

            ready = await self._wait_for_ready(timeout=30)
            if ready:
                self._status = EngineStatus.RUNNING
                logger.info("[OllamaEngine] Ollama started successfully.")
                return {"status": "running", "message": "Ollama iniciado com sucesso."}
            else:
                self._status = EngineStatus.ERROR
                return {"status": "error", "message": "Ollama iniciou mas nao respondeu em 30s."}

        except FileNotFoundError:
            self._status = EngineStatus.ERROR
            logger.error("[OllamaEngine] Comando 'ollama' nao encontrado. Ollama esta instalado?")
            return {"status": "error", "message": "Ollama nao esta instalado neste Mac."}
        except Exception as exc:
            self._status = EngineStatus.ERROR
            logger.error("[OllamaEngine] Erro ao iniciar: %s", exc)
            return {"status": "error", "message": f"Erro ao iniciar: {exc}"}

    async def stop(self) -> dict:
        """Desliga o motor Ollama e libera memoria."""
        self._status = EngineStatus.STOPPING
        logger.info("[OllamaEngine] Stopping ollama...")

        try:
            proc = await asyncio.create_subprocess_exec(
                "ollama", "stop", self.model_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.wait(), timeout=10)
        except Exception:
            pass

        try:
            proc = await asyncio.create_subprocess_exec(
                "pkill", "-f", "ollama serve",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.wait(), timeout=5)
        except Exception:
            pass

        await asyncio.sleep(1)
        if not await self._is_ollama_running():
            self._status = EngineStatus.STOPPED
            logger.info("[OllamaEngine] Ollama stopped. RAM liberada.")
            return {"status": "stopped", "message": "Ollama parado. Memoria liberada."}
        else:
            self._status = EngineStatus.ERROR
            return {"status": "error", "message": "Ollama nao parou. Tente matar manualmente."}

    async def get_status(self) -> dict:
        """Status completo do motor."""
        is_running = await self._is_ollama_running()

        if is_running:
            self._status = EngineStatus.RUNNING
        elif self._status not in (EngineStatus.STARTING, EngineStatus.STOPPING):
            self._status = EngineStatus.STOPPED

        memory_info = {}
        if is_running:
            memory_info = await self._get_memory_usage()

        return {
            "status": self._status.value,
            "model": self.model_name,
            "url": self.ollama_url,
            "memory": memory_info,
        }

    async def _is_ollama_running(self) -> bool:
        """Verifica se Ollama responde a health check."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def _wait_for_ready(self, timeout: int = 30) -> bool:
        """Polling ate Ollama responder."""
        for _ in range(timeout):
            if await self._is_ollama_running():
                return True
            await asyncio.sleep(1)
        return False

    async def _get_memory_usage(self) -> dict:
        """Tenta pegar uso de RAM do processo Ollama."""
        try:
            import psutil
            for proc in psutil.process_iter(["name", "memory_info"]):
                if "ollama" in (proc.info.get("name") or "").lower():
                    mem = proc.info["memory_info"]
                    return {
                        "rss_mb": round(mem.rss / 1024 / 1024),
                        "vms_mb": round(mem.vms / 1024 / 1024),
                    }
        except Exception:
            pass
        return {}
