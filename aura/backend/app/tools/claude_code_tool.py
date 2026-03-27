"""
Claude Code Tool — Envia prompts pro Claude Code CLI.

ESSE E O DIFERENCIAL: a Aura pode mandar tarefas pro Claude Code
que executa no terminal com acesso total ao filesystem.

Equivale a Gregory sentado no terminal digitando `claude -p "..."`.

- L1: executa sem pedir aprovacao (autonomia total para tarefas de engenharia)
- Timeout: 10 minutos (tarefas complexas levam tempo)
- Output: captura stdout/stderr completo
"""

import asyncio
import os
import shutil
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class ClaudeCodeTool(BaseTool):
    name = "claude_code"
    description = (
        "Envia um prompt para o Claude Code CLI que executa no terminal com acesso total "
        "ao computador. Use para: implementar features, corrigir bugs, refatorar codigo, "
        "criar arquivos complexos, rodar analises, qualquer tarefa de engenharia."
    )
    category = "development"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Prompt detalhado para o Claude Code executar"
            },
            "working_dir": {
                "type": "string",
                "description": "Diretorio de trabalho (padrao: ~/Projetos/aura_v1/aura)"
            },
            "dangerously_skip_permissions": {
                "type": "boolean",
                "description": "Se true, pula confirmacoes do Claude Code (padrao: false)"
            }
        },
        "required": ["prompt"]
    }

    async def execute(self, params: dict) -> ToolResult:
        # Verificar se claude esta instalado
        claude_path = shutil.which("claude")
        if not claude_path:
            return ToolResult(
                success=False,
                output=None,
                error="Claude Code CLI nao encontrado no PATH. Instale com: npm install -g @anthropic-ai/claude-code"
            )

        prompt = params["prompt"]
        working_dir = os.path.expanduser(
            params.get("working_dir", "~/Projetos/aura_v1/aura")
        )
        skip_perms = params.get("dangerously_skip_permissions", False)

        # Escape prompt for shell safety
        safe_prompt = prompt.replace('"', '\\"')
        cmd = f'claude -p "{safe_prompt}" --no-input'
        if skip_perms:
            cmd = f'claude --dangerously-skip-permissions -p "{safe_prompt}" --no-input'

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=600  # 10 minutos
            )

            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(
                    success=True,
                    output=output[:100000]  # Limitar a 100KB
                )
            else:
                return ToolResult(
                    success=False,
                    output=output[:50000],
                    error=f"Claude Code retornou erro: {errors[:5000]}"
                )
        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                output=None,
                error="Timeout: Claude Code excedeu 10 minutos"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
