"""
Ollama Lifecycle Manager — Liga e desliga o Ollama automaticamente.

Comportamento:
- Quando uma mensagem chega que precisa do Qwen -> liga Ollama automaticamente
- Apos 10 minutos sem uso -> desliga Ollama e libera RAM
- Se Ollama ja esta rodando -> usa direto
- Se Ollama falha ao ligar -> fallback pro Claude API

Isso elimina a necessidade de Gregory clicar no botao de ignicao.
O botao continua existindo como override manual, mas o padrao e automatico.

Gregory liga o Mac -> backend + frontend + ngrok sobem (leves)
Gregory manda mensagem de voz -> Brain Router decide se precisa de Qwen
Se precisa -> Ollama liga automaticamente -> processa -> responde
Depois de 10 min sem uso -> Ollama desliga sozinho -> RAM liberada
"""

import asyncio
import logging
import os
import subprocess
import time
from typing import Optional

logger = logging.getLogger("aura")

IDLE_TIMEOUT_SECONDS = 600  # 10 minutos sem uso -> desliga


class OllamaLifecycle:
    def __init__(self, ollama_url: str = "http://localhost:11434", model_name: str = "qwen3:latest"):
        self.ollama_url = ollama_url
        self.model_name = model_name
        self.last_used_at: Optional[float] = None
        self.is_starting = False
        self._idle_task: Optional[asyncio.Task] = None
        self._process: Optional[asyncio.subprocess.Process] = None

    async def is_running(self) -> bool:
        """Verifica se Ollama esta rodando e respondendo."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def ensure_running(self) -> bool:
        """
        Garante que o Ollama esta rodando. Liga se necessario.
        Retorna True se esta pronto, False se falhou.

        Este metodo e chamado automaticamente pelo AgentService antes de
        enviar mensagem pro Qwen. Gregory nao precisa fazer nada.
        """
        # Ja esta rodando
        if await self.is_running():
            self.last_used_at = time.time()
            self._restart_idle_timer()
            return True

        # Ja esta iniciando (outra chamada concorrente)
        if self.is_starting:
            # Esperar ate 30s pelo start concorrente
            for _ in range(30):
                await asyncio.sleep(1)
                if await self.is_running():
                    self.last_used_at = time.time()
                    return True
            return False

        # Precisa iniciar
        self.is_starting = True
        logger.info("[OllamaLifecycle] Iniciando Ollama automaticamente...")

        try:
            # Iniciar ollama serve
            self._process = await asyncio.create_subprocess_exec(
                "ollama", "serve",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                env={**os.environ, "OLLAMA_HOST": "0.0.0.0:11434"},
            )

            # Esperar ficar ready (max 30s)
            for i in range(30):
                await asyncio.sleep(1)
                if await self.is_running():
                    logger.info(f"[OllamaLifecycle] Ollama pronto em {i+1}s")
                    self.last_used_at = time.time()
                    self.is_starting = False
                    self._restart_idle_timer()
                    return True

            logger.error("[OllamaLifecycle] Ollama nao ficou pronto em 30s")
            self.is_starting = False
            return False

        except FileNotFoundError:
            logger.error("[OllamaLifecycle] Comando 'ollama' nao encontrado no PATH")
            self.is_starting = False
            return False
        except Exception as e:
            logger.error(f"[OllamaLifecycle] Erro ao iniciar: {e}")
            self.is_starting = False
            return False

    async def stop(self) -> bool:
        """Para o Ollama e libera RAM."""
        logger.info("[OllamaLifecycle] Desligando Ollama...")
        try:
            # Descarregar modelo da memoria
            proc = await asyncio.create_subprocess_exec(
                "ollama", "stop", self.model_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=10)
        except Exception:
            pass

        try:
            # Matar processo
            subprocess.run(["pkill", "-f", "ollama"], capture_output=True)
            await asyncio.sleep(1)

            if not await self.is_running():
                logger.info("[OllamaLifecycle] Ollama desligado. RAM liberada.")
                self.last_used_at = None
                return True
            else:
                # Force kill
                subprocess.run(["pkill", "-9", "-f", "ollama"], capture_output=True)
                await asyncio.sleep(1)
                return not await self.is_running()
        except Exception as e:
            logger.error(f"[OllamaLifecycle] Erro ao desligar: {e}")
            return False

    def mark_used(self):
        """Marca que o Ollama foi usado agora. Reseta o timer de idle."""
        self.last_used_at = time.time()
        self._restart_idle_timer()

    def _restart_idle_timer(self):
        """Reinicia o timer de desligamento automatico."""
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                self._idle_task = asyncio.ensure_future(self._idle_shutdown())
        except RuntimeError:
            pass

    async def _idle_shutdown(self):
        """Desliga Ollama apos periodo de inatividade."""
        await asyncio.sleep(IDLE_TIMEOUT_SECONDS)
        if self.last_used_at and (time.time() - self.last_used_at) >= IDLE_TIMEOUT_SECONDS:
            logger.info(f"[OllamaLifecycle] {IDLE_TIMEOUT_SECONDS // 60}min sem uso. Desligando Ollama...")
            await self.stop()

    async def get_status(self) -> dict:
        """Status completo para o frontend."""
        running = await self.is_running()

        memory_mb = 0
        if running:
            try:
                result = subprocess.run(
                    ["pgrep", "-f", "ollama"],
                    capture_output=True, text=True
                )
                pids = result.stdout.strip().split("\n")
                for pid in pids:
                    if pid:
                        ps = subprocess.run(
                            ["ps", "-o", "rss=", "-p", pid],
                            capture_output=True, text=True
                        )
                        rss = ps.stdout.strip()
                        if rss.isdigit():
                            memory_mb += int(rss) // 1024
            except Exception:
                pass

        idle_seconds = None
        if self.last_used_at:
            idle_seconds = int(time.time() - self.last_used_at)

        return {
            "status": "running" if running else ("starting" if self.is_starting else "stopped"),
            "model": self.model_name,
            "memory_mb": memory_mb,
            "idle_seconds": idle_seconds,
            "auto_shutdown_minutes": IDLE_TIMEOUT_SECONDS // 60,
            "seconds_until_shutdown": max(0, IDLE_TIMEOUT_SECONDS - (idle_seconds or 0)) if idle_seconds else None,
        }
