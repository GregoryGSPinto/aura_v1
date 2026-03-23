"""
Claude Code Tool — Executa prompts via Claude Code CLI.

Permite à Aura delegar tarefas complexas de código, análise,
commits e deploys para o Claude Code.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

logger = logging.getLogger("aura")

DEFAULT_WORKING_DIR = "/Users/user_pc/Projetos/aura_v1"
TIMEOUT_SECONDS = 300  # 5 minutos


class ClaudeTool:

    def __init__(self, working_dir: str = DEFAULT_WORKING_DIR):
        self.working_dir = working_dir

    async def execute(self, prompt: str, working_dir: Optional[str] = None) -> dict:
        """Envia um prompt para o Claude Code CLI e retorna o resultado."""
        cwd = working_dir or self.working_dir

        logger.info("[ClaudeTool] Executando prompt em %s (%d chars)", cwd, len(prompt))

        try:
            process = await asyncio.create_subprocess_exec(
                "claude", "-p", prompt, "--no-input",
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=TIMEOUT_SECONDS,
            )

            exit_code = process.returncode or 0
            output = stdout.decode("utf-8", errors="replace").strip()
            error = stderr.decode("utf-8", errors="replace").strip()

            logger.info("[ClaudeTool] Concluido (exit_code=%d, output=%d chars)", exit_code, len(output))

            return {
                "output": output,
                "error": error,
                "exit_code": exit_code,
            }

        except asyncio.TimeoutError:
            logger.error("[ClaudeTool] Timeout apos %ds", TIMEOUT_SECONDS)
            try:
                process.kill()
                await process.communicate()
            except Exception:
                pass
            return {
                "output": "",
                "error": f"Timeout: Claude Code nao respondeu em {TIMEOUT_SECONDS}s.",
                "exit_code": -1,
            }

        except FileNotFoundError:
            logger.error("[ClaudeTool] CLI 'claude' nao encontrado no PATH")
            return {
                "output": "",
                "error": "Claude Code CLI nao encontrado. Instale com: npm install -g @anthropic-ai/claude-code",
                "exit_code": -1,
            }

        except Exception as exc:
            logger.error("[ClaudeTool] Erro: %s", exc)
            return {
                "output": "",
                "error": str(exc),
                "exit_code": -1,
            }
