"""
macOS Tool — Controle do sistema via AppleScript e comandos nativos.

- Abrir apps, controlar volume, notificacoes -> L1/L2
- Controlar Finder, mover arquivos -> L2
- Configuracoes de sistema -> L3
"""

import asyncio
import os
from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class MacOSTool(BaseTool):
    name = "macos"
    description = "Controla o macOS: abrir apps, notificacoes, volume, clipboard, Finder, processos."
    category = "system"
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_app", "quit_app", "notification", "volume", "clipboard_get",
                         "clipboard_set", "open_finder", "list_processes", "system_info",
                         "say", "open_file"],
                "description": "Acao do sistema"
            },
            "target": {"type": "string", "description": "App/arquivo/texto alvo da acao"},
            "value": {"type": "string", "description": "Valor (volume 0-100, texto do clipboard, etc)"},
        },
        "required": ["action"]
    }

    async def _applescript(self, script: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode().strip())
        return stdout.decode().strip()

    async def execute(self, params: dict) -> ToolResult:
        action = params["action"]
        target = params.get("target", "")
        value = params.get("value", "")

        try:
            if action == "open_app":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                await self._applescript(f'tell application "{target}" to activate')
                return ToolResult(success=True, output=f"App aberto: {target}")

            elif action == "quit_app":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                await self._applescript(f'tell application "{target}" to quit')
                return ToolResult(success=True, output=f"App fechado: {target}")

            elif action == "notification":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                title = target or "Aura"
                msg = value or "Notificacao"
                await self._applescript(
                    f'display notification "{msg}" with title "{title}" sound name "Glass"'
                )
                return ToolResult(success=True, output=f"Notificacao enviada: {msg}")

            elif action == "volume":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                vol = int(value) if value else 50
                await self._applescript(f'set volume output volume {vol}')
                return ToolResult(success=True, output=f"Volume: {vol}%")

            elif action == "clipboard_get":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                content = await self._applescript('return (the clipboard)')
                return ToolResult(success=True, output=f"Clipboard: {content[:5000]}")

            elif action == "clipboard_set":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                await self._applescript(f'set the clipboard to "{value}"')
                return ToolResult(success=True, output="Clipboard atualizado")

            elif action == "open_finder":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                path = os.path.expanduser(target or "~/Projetos")
                await self._applescript(f'tell application "Finder" to open POSIX file "{path}"')
                return ToolResult(success=True, output=f"Finder aberto: {path}")

            elif action == "open_file":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                path = os.path.expanduser(target)
                proc = await asyncio.create_subprocess_exec("open", path)
                await proc.wait()
                return ToolResult(success=True, output=f"Arquivo aberto: {path}")

            elif action == "list_processes":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                proc = await asyncio.create_subprocess_shell(
                    "ps aux --sort=-%mem | head -20",
                    stdout=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                return ToolResult(success=True, output=stdout.decode().strip())

            elif action == "system_info":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                info = []
                for cmd, label in [
                    ("sw_vers", "macOS"), ("uptime", "Uptime"),
                    ("df -h /", "Disco"), ("vm_stat | head -5", "Memoria"),
                ]:
                    proc = await asyncio.create_subprocess_shell(
                        cmd, stdout=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    info.append(f"=== {label} ===\n{stdout.decode().strip()}")
                return ToolResult(success=True, output="\n\n".join(info))

            elif action == "say":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                text = value or target
                proc = await asyncio.create_subprocess_exec(
                    "say", "-v", "Luciana", text
                )
                await proc.wait()
                return ToolResult(success=True, output=f"Falou: {text}")

            else:
                return ToolResult(success=False, output=None, error=f"Acao desconhecida: {action}")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
