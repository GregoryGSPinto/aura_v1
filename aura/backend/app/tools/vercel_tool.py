"""
Vercel Tool — Deploy e gerenciamento de projetos na Vercel.

Usa a Vercel CLI (`vercel` instalado globalmente).
- Status/list -> L1
- Deploy -> L2
- Delete -> L3 BLOQUEADO
"""

import asyncio
import os
from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class VercelTool(BaseTool):
    name = "vercel"
    description = "Deploy e gerenciamento de projetos Vercel. Pode deployar, listar projetos, verificar status de deploy."
    category = "deployment"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["deploy", "deploy_prod", "list", "status", "logs", "env_list"],
                "description": "Operacao Vercel"
            },
            "project_path": {
                "type": "string",
                "description": "Caminho do projeto (padrao: ~/Projetos/aura_v1)"
            },
            "args": {
                "type": "string",
                "description": "Argumentos adicionais"
            }
        },
        "required": ["operation"]
    }

    async def execute(self, params: dict) -> ToolResult:
        operation = params["operation"]
        project_path = os.path.expanduser(params.get("project_path", "~/Projetos/aura_v1"))
        args = params.get("args", "")

        # Classificar
        if operation in ("list", "status", "logs", "env_list"):
            self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
        elif operation in ("deploy", "deploy_prod"):
            self.autonomy_level = AutonomyLevel.L2_APPROVAL
        else:
            self.autonomy_level = AutonomyLevel.L2_APPROVAL

        cmd_map = {
            "deploy": f"vercel --yes {args}".strip(),
            "deploy_prod": f"vercel --prod --yes --force {args}".strip(),
            "list": "vercel ls",
            "status": "vercel inspect --yes 2>/dev/null || vercel ls --limit 1",
            "logs": f"vercel logs {args}".strip(),
            "env_list": "vercel env ls",
        }

        cmd = cmd_map.get(operation)
        if not cmd:
            return ToolResult(success=False, output=None, error=f"Operacao desconhecida: {operation}")

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_path,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(success=True, output=output)
            else:
                return ToolResult(success=False, output=output, error=errors)
        except asyncio.TimeoutError:
            return ToolResult(success=False, output=None, error="Timeout: Vercel excedeu 5 minutos")
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
