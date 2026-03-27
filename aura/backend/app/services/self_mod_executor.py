"""
Self-Modification Executor — Executa planos aprovados.

Fluxo:
1. Recebe plano aprovado
2. Executa via Claude Code CLI (claude -p "..." --no-input)
3. Monitora progresso
4. Valida resultado (backend importa? frontend builda?)
5. Se OK -> commit + push automático
6. Se FALHA -> reverte (git checkout) + reporta erro
7. Reporta resultado completo ao Gregory
"""

import asyncio
import os
import shutil
import logging
from typing import Optional
from datetime import datetime

from app.services.self_mod_planner import ModificationPlan

logger = logging.getLogger("aura")

AURA_ROOT = os.path.expanduser("~/Projetos/aura_v1")
BACKEND_DIR = os.path.join(AURA_ROOT, "aura/backend")
FRONTEND_DIR = os.path.join(AURA_ROOT, "aura/frontend")


class SelfModExecutor:
    """Executa planos de auto-modificação aprovados."""

    async def execute(self, plan: ModificationPlan) -> dict:
        """
        Executa um plano de auto-modificação.

        Retorna:
        {
            "success": bool,
            "output": str (output do Claude Code),
            "validation": {
                "backend_ok": bool,
                "frontend_ok": bool,
                "tests_ok": bool,
            },
            "committed": bool,
            "commit_hash": str | None,
            "error": str | None,
            "execution_time_seconds": float,
        }
        """
        start = asyncio.get_event_loop().time()
        plan.status = "executing"

        logger.info(f"[SelfMod] Executando plano {plan.id}: {plan.request}")

        # 1. Snapshot do estado atual (pra poder reverter)
        snapshot_hash = await self._git_snapshot()

        # 2. Executar via Claude Code
        claude_result = await self._run_claude_code(plan.claude_code_prompt)

        if not claude_result["success"]:
            await self._rollback(snapshot_hash)
            return {
                "success": False,
                "output": claude_result["output"],
                "validation": {"backend_ok": False, "frontend_ok": False, "tests_ok": False},
                "committed": False,
                "commit_hash": None,
                "error": f"Claude Code falhou: {claude_result['error']}",
                "execution_time_seconds": asyncio.get_event_loop().time() - start,
            }

        # 3. Validar resultado
        validation = await self._validate(plan)

        if not validation["backend_ok"]:
            logger.warning("[SelfMod] Validação falhou — revertendo")
            await self._rollback(snapshot_hash)
            return {
                "success": False,
                "output": claude_result["output"],
                "validation": validation,
                "committed": False,
                "commit_hash": None,
                "error": "Validação do backend falhou. Mudanças revertidas.",
                "execution_time_seconds": asyncio.get_event_loop().time() - start,
            }

        # 4. Commit + push
        commit_hash = await self._commit_and_push(plan)

        # 5. Reiniciar backend se necessário
        if plan.requires_restart:
            await self._restart_backend()

        return {
            "success": True,
            "output": claude_result["output"][:5000],  # Limitar output
            "validation": validation,
            "committed": True,
            "commit_hash": commit_hash,
            "error": None,
            "execution_time_seconds": asyncio.get_event_loop().time() - start,
        }

    async def _git_snapshot(self) -> str:
        """Salva o estado atual do git pra poder reverter."""
        proc = await asyncio.create_subprocess_shell(
            "git rev-parse HEAD",
            stdout=asyncio.subprocess.PIPE,
            cwd=AURA_ROOT,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode().strip()

    async def _rollback(self, commit_hash: str):
        """Reverte pra snapshot anterior."""
        logger.warning(f"[SelfMod] Revertendo para {commit_hash[:8]}")
        proc = await asyncio.create_subprocess_shell(
            "git checkout -- . && git clean -fd",
            cwd=AURA_ROOT,
        )
        await proc.wait()

    async def _run_claude_code(self, prompt: str) -> dict:
        """Executa o Claude Code CLI."""
        claude_path = shutil.which("claude")
        if not claude_path:
            return {
                "success": False,
                "output": "",
                "error": "Claude Code CLI não encontrado no PATH",
            }

        # Escapar aspas no prompt
        safe_prompt = prompt.replace('"', '\\"')
        cmd = f'claude --dangerously-skip-permissions -p "{safe_prompt}" --no-input'

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

            output = stdout.decode("utf-8", errors="replace")
            errors = stderr.decode("utf-8", errors="replace")

            return {
                "success": proc.returncode == 0,
                "output": output,
                "error": errors if proc.returncode != 0 else None,
            }
        except asyncio.TimeoutError:
            return {
                "success": False,
                "output": "",
                "error": "Timeout: Claude Code excedeu 10 minutos",
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
            }

    async def _validate(self, plan: ModificationPlan) -> dict:
        """Valida que as mudanças não quebraram nada."""
        result = {"backend_ok": True, "frontend_ok": True, "tests_ok": True}

        # Validar backend (importação)
        if "backend" in plan.analysis.get("affected_areas", []):
            proc = await asyncio.create_subprocess_shell(
                'python3 -c "from app.main import create_app; print(\'OK\')"',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=BACKEND_DIR,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            result["backend_ok"] = proc.returncode == 0 and "OK" in stdout.decode()
            if not result["backend_ok"]:
                logger.error(f"[SelfMod] Backend validation failed: {stderr.decode()[:500]}")

        # Validar frontend (TypeScript)
        if "frontend" in plan.analysis.get("affected_areas", []):
            proc = await asyncio.create_subprocess_shell(
                "pnpm tsc --noEmit",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=FRONTEND_DIR,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            result["frontend_ok"] = proc.returncode == 0
            if not result["frontend_ok"]:
                logger.error(f"[SelfMod] Frontend validation failed: {stderr.decode()[:500]}")

        return result

    async def _commit_and_push(self, plan: ModificationPlan) -> Optional[str]:
        """Commit e push das mudanças."""
        try:
            # Add
            await (await asyncio.create_subprocess_shell(
                "git add -A", cwd=AURA_ROOT
            )).wait()

            # Commit
            msg = f"\u2726 self-mod: {plan.request[:60]}"
            proc = await asyncio.create_subprocess_shell(
                f'git commit -m "{msg}"',
                stdout=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
            )
            stdout, _ = await proc.communicate()

            # Extrair hash
            hash_proc = await asyncio.create_subprocess_shell(
                "git rev-parse --short HEAD",
                stdout=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
            )
            hash_out, _ = await hash_proc.communicate()
            commit_hash = hash_out.decode().strip()

            # Push
            await (await asyncio.create_subprocess_shell(
                "git push origin main", cwd=AURA_ROOT
            )).wait()

            logger.info(f"[SelfMod] Committed and pushed: {commit_hash}")
            return commit_hash

        except Exception as e:
            logger.error(f"[SelfMod] Commit/push failed: {e}")
            return None

    async def _restart_backend(self):
        """Reinicia o backend da Aura."""
        logger.info("[SelfMod] Reiniciando backend...")
        try:
            # Kill backend atual
            await (await asyncio.create_subprocess_shell(
                "lsof -ti:8000 | xargs kill -9 2>/dev/null"
            )).wait()

            await asyncio.sleep(2)

            # Reiniciar
            await asyncio.create_subprocess_shell(
                f"cd {BACKEND_DIR} && nohup python3 -m uvicorn app.main:app "
                f"--host 0.0.0.0 --port 8000 >> ~/aura-boot.log 2>&1 &",
                cwd=BACKEND_DIR,
            )

            # Esperar ficar ready
            for _ in range(10):
                await asyncio.sleep(2)
                proc = await asyncio.create_subprocess_shell(
                    "curl -s http://localhost:8000/docs > /dev/null",
                )
                if (await proc.wait()) == 0:
                    logger.info("[SelfMod] Backend reiniciado com sucesso")
                    return

            logger.warning("[SelfMod] Backend não respondeu após restart")
        except Exception as e:
            logger.error(f"[SelfMod] Restart failed: {e}")
