"""
Shell Tool — Executa comandos no terminal do Mac.

Seguranca:
- Comandos destrutivos (rm -rf, mkfs, dd) -> L3 BLOQUEADO
- Comandos que modificam sistema (sudo, chmod 777) -> L2
- Comandos de leitura (ls, cat, grep, find, wc) -> L1
- Timeout de 120 segundos por comando
- Working directory sempre validado
"""

import asyncio
import os
import re
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


# Patterns de comandos perigosos — NUNCA executar
L3_BLOCKED_PATTERNS = [
    r'\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?/',  # rm -rf /
    r'\brm\s+-rf\s+~',          # rm -rf ~
    r'\bmkfs\b',                 # formatar disco
    r'\bdd\s+if=',               # dd
    r'>\s*/dev/',                 # redirecionar para device
    r'\bsudo\s+rm\b',            # sudo rm
    r'\bsudo\s+mkfs\b',          # sudo mkfs
    r':\(\)\{\s*:\|:&\s*\};:',  # fork bomb
    r'\bshutdown\b',             # desligar
    r'\breboot\b',               # reiniciar
    r'\bsudo\s+passwd\b',        # trocar senha
    r'\bcurl\b.*\|\s*sudo\s+bash',  # curl | sudo bash
]

# Patterns que precisam de aprovacao
L2_APPROVAL_PATTERNS = [
    r'\bsudo\b',                 # qualquer sudo
    r'\brm\s',                   # rm (sem ser rm -rf /)
    r'\bchmod\b',                # mudar permissoes
    r'\bchown\b',                # mudar dono
    r'\bkill\b',                 # matar processo
    r'\bkillall\b',              # matar processos
    r'\bgit\s+push\b',           # git push
    r'\bgit\s+push\s+.*--force', # git push --force
    r'\bnpm\s+publish\b',        # publicar pacote
    r'\bvercel\s+deploy\b',      # deploy
    r'\bpip\s+install\b',        # instalar pacote
    r'\bnpm\s+install\b',        # instalar pacote
    r'\bbrew\s+install\b',       # instalar pacote
]

# Patterns seguros — sempre L1
L1_SAFE_PATTERNS = [
    r'^\s*(ls|cat|head|tail|grep|find|wc|echo|pwd|whoami|date|uptime|df|du|file|which|type|man)',
    r'^\s*(git\s+(status|log|diff|branch|remote|show))',
    r'^\s*(python3?\s+-c)',
    r'^\s*(node\s+-e)',
    r'^\s*(curl\s+-s)',          # curl read-only
    r'^\s*(tree|bat|less|more)',
]


class ShellTool(BaseTool):
    name = "shell"
    description = "Executa comandos no terminal do Mac. Use para qualquer operacao: listar arquivos, rodar scripts, git, compilar, testar, etc."
    category = "system"
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "Comando bash a executar"
            },
            "working_dir": {
                "type": "string",
                "description": "Diretorio de trabalho (padrao: ~/Projetos/aura_v1/aura)"
            },
            "timeout": {
                "type": "integer",
                "description": "Timeout em segundos (padrao: 120, maximo: 600)"
            }
        },
        "required": ["command"]
    }

    def _classify_command(self, command: str) -> AutonomyLevel:
        """Classifica o nivel de autonomia de um comando."""
        # L3: NUNCA executar
        for pattern in L3_BLOCKED_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L3_BLOCKED

        # L1: Seguro
        for pattern in L1_SAFE_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L1_AUTONOMOUS

        # L2: Precisa aprovacao
        for pattern in L2_APPROVAL_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L2_APPROVAL

        # Default: L2 (na duvida, pede aprovacao)
        return AutonomyLevel.L2_APPROVAL

    async def execute(self, params: dict) -> ToolResult:
        command = params["command"]
        working_dir = os.path.expanduser(params.get("working_dir", "~/Projetos/aura_v1/aura"))
        timeout = min(params.get("timeout", 120), 600)

        # Reclassifica autonomia baseado no comando especifico
        self.autonomy_level = self._classify_command(command)

        if self.autonomy_level == AutonomyLevel.L3_BLOCKED:
            return ToolResult(
                success=False,
                output=None,
                error=f"BLOQUEADO: Comando perigoso detectado: {command}"
            )

        if not os.path.isdir(working_dir):
            return ToolResult(
                success=False,
                output=None,
                error=f"Diretorio nao existe: {working_dir}"
            )

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )

            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(
                    success=True,
                    output=output if output else "(sem saida)",
                )
            else:
                return ToolResult(
                    success=False,
                    output=output,
                    error=f"Exit code {proc.returncode}: {errors}",
                )
        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                output=None,
                error=f"Timeout: comando excedeu {timeout}s"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
