"""
Git Tool — Operacoes git completas.

- Status, log, diff, branch -> L1 (leitura)
- Add, commit -> L2 (modifica repositorio local)
- Push, force push -> L2 (modifica remoto)
- Delete branch, force push -> L3 no main/master
"""

import asyncio
import os
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class GitAgentTool(BaseTool):
    name = "git"
    description = "Operacoes git: status, diff, log, add, commit, push, pull, branch, checkout."
    category = "version_control"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["status", "diff", "log", "branch", "add", "commit", "push", "pull",
                         "checkout", "stash", "stash_pop", "remote"],
                "description": "Operacao git a executar"
            },
            "args": {
                "type": "string",
                "description": "Argumentos adicionais (ex: mensagem de commit, nome de branch, arquivo para diff)"
            },
            "repo_path": {
                "type": "string",
                "description": "Caminho do repositorio (padrao: ~/Projetos/aura_v1)"
            }
        },
        "required": ["operation"]
    }

    READONLY_OPS = {"status", "diff", "log", "branch", "remote"}
    WRITE_OPS = {"add", "commit", "push", "pull", "checkout", "stash", "stash_pop"}

    async def execute(self, params: dict) -> ToolResult:
        operation = params["operation"]
        args = params.get("args", "")
        repo = os.path.expanduser(params.get("repo_path", "~/Projetos/aura_v1"))

        # Classificar autonomia
        if operation in self.READONLY_OPS:
            self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
        elif operation == "push" and "--force" in args:
            self.autonomy_level = AutonomyLevel.L3_BLOCKED
            return ToolResult(success=False, output=None,
                              error="BLOQUEADO: git push --force nao e permitido pela Aura")
        else:
            self.autonomy_level = AutonomyLevel.L2_APPROVAL

        # Montar comando
        cmd_map = {
            "status": "git status --porcelain",
            "diff": f"git diff {args}".strip(),
            "log": f"git log --oneline -20 {args}".strip(),
            "branch": "git branch -a",
            "add": f"git add {args if args else '-A'}",
            "commit": f'git commit -m "{args}"' if args else 'git commit',
            "push": f"git push {args}".strip(),
            "pull": f"git pull {args}".strip(),
            "checkout": f"git checkout {args}",
            "stash": "git stash",
            "stash_pop": "git stash pop",
            "remote": "git remote -v",
        }

        cmd = cmd_map.get(operation)
        if not cmd:
            return ToolResult(success=False, output=None, error=f"Operacao desconhecida: {operation}")

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=repo,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(success=True, output=output or "(sem alteracoes)")
            else:
                return ToolResult(success=False, output=output, error=errors)
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
