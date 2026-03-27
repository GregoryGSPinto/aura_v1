"""
Browser Tool — Automacao de navegador via AppleScript.

Usa AppleScript para controlar Chrome/Safari que ja esta aberto.

Casos de uso reais:
- Abrir Vercel dashboard e verificar status de deploy
- Abrir GitHub e criar PR
- Navegar documentacao e extrair info
- Preencher formularios web

Seguranca:
- Abrir URL -> L1
- Ler conteudo de pagina -> L1
- Clicar/preencher -> L2
- Login/credenciais -> L3 BLOQUEADO
"""

import asyncio
import os
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class BrowserAgentTool(BaseTool):
    name = "browser"
    description = (
        "Controla o navegador do Mac. Pode abrir URLs, ler conteudo de paginas, "
        "clicar em elementos, preencher formularios. Usa AppleScript para Chrome/Safari."
    )
    category = "browser"
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_url", "get_page_content", "get_page_title",
                         "get_current_url", "click_element", "fill_input",
                         "screenshot", "run_javascript", "list_tabs"],
                "description": "Acao a executar no navegador"
            },
            "url": {"type": "string", "description": "URL a abrir (para open_url)"},
            "selector": {"type": "string", "description": "Seletor CSS do elemento (para click/fill)"},
            "value": {"type": "string", "description": "Valor a preencher (para fill_input)"},
            "javascript": {"type": "string", "description": "Codigo JS a executar na pagina (para run_javascript)"},
            "browser": {"type": "string", "enum": ["chrome", "safari"], "description": "Navegador (padrao: chrome)"},
        },
        "required": ["action"]
    }

    READONLY_ACTIONS = {"get_page_content", "get_page_title", "get_current_url", "list_tabs"}
    WRITE_ACTIONS = {"click_element", "fill_input", "run_javascript"}
    L3_PATTERNS = ["password", "login", "signin", "credential", "token", "api_key", "secret"]

    def _classify_action(self, action: str, params: dict) -> AutonomyLevel:
        # Verificar se envolve credenciais
        all_text = " ".join(str(v) for v in params.values()).lower()
        if any(p in all_text for p in self.L3_PATTERNS):
            return AutonomyLevel.L3_BLOCKED

        if action == "open_url":
            return AutonomyLevel.L1_AUTONOMOUS
        if action == "screenshot":
            return AutonomyLevel.L1_AUTONOMOUS
        if action in self.READONLY_ACTIONS:
            return AutonomyLevel.L1_AUTONOMOUS
        if action in self.WRITE_ACTIONS:
            return AutonomyLevel.L2_APPROVAL
        return AutonomyLevel.L2_APPROVAL

    async def _run_applescript(self, script: str) -> str:
        """Executa AppleScript e retorna resultado."""
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode().strip())
        return stdout.decode().strip()

    async def execute(self, params: dict) -> ToolResult:
        action = params["action"]
        browser = params.get("browser", "chrome")
        app_name = "Google Chrome" if browser == "chrome" else "Safari"

        self.autonomy_level = self._classify_action(action, params)
        if self.autonomy_level == AutonomyLevel.L3_BLOCKED:
            return ToolResult(success=False, output=None,
                              error="BLOQUEADO: Acao envolve credenciais/login — requer acao direta do Gregory")

        try:
            if action == "open_url":
                url = params.get("url", "")
                if not url:
                    return ToolResult(success=False, output=None, error="URL obrigatoria")
                await self._run_applescript(
                    f'tell application "{app_name}" to open location "{url}"'
                )
                await self._run_applescript(f'tell application "{app_name}" to activate')
                return ToolResult(success=True, output=f"Aberto: {url} no {app_name}")

            elif action == "get_page_title":
                if browser == "chrome":
                    title = await self._run_applescript(
                        f'tell application "{app_name}" to get title of active tab of front window'
                    )
                else:
                    title = await self._run_applescript(
                        f'tell application "{app_name}" to get name of front document'
                    )
                return ToolResult(success=True, output=f"Titulo: {title}")

            elif action == "get_current_url":
                if browser == "chrome":
                    url = await self._run_applescript(
                        f'tell application "{app_name}" to get URL of active tab of front window'
                    )
                else:
                    url = await self._run_applescript(
                        f'tell application "{app_name}" to get URL of front document'
                    )
                return ToolResult(success=True, output=url)

            elif action == "get_page_content":
                if browser == "chrome":
                    content = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "document.body.innerText.substring(0, 50000)"'
                    )
                else:
                    content = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript '
                        f'"document.body.innerText.substring(0, 50000)" in front document'
                    )
                return ToolResult(success=True, output=content[:50000])

            elif action == "run_javascript":
                js = params.get("javascript", "")
                if not js:
                    return ToolResult(success=False, output=None, error="JavaScript obrigatorio")
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=result)

            elif action == "list_tabs":
                if browser == "chrome":
                    tabs = await self._run_applescript(
                        f'tell application "{app_name}" to get {{title, URL}} of every tab of front window'
                    )
                else:
                    tabs = await self._run_applescript(
                        f'tell application "{app_name}" to get {{name, URL}} of every document'
                    )
                return ToolResult(success=True, output=tabs)

            elif action == "click_element":
                selector = params.get("selector", "")
                js = f"document.querySelector('{selector}')?.click(); 'clicked'"
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=f"Clicado: {selector}")

            elif action == "fill_input":
                selector = params.get("selector", "")
                value = params.get("value", "")
                js = (f"var el = document.querySelector('{selector}'); "
                      f"if(el){{el.value='{value}'; el.dispatchEvent(new Event('input', {{bubbles:true}})); 'filled'}} "
                      f"else {{'not found'}}")
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=f"Preenchido: {selector} = {value}")

            elif action == "screenshot":
                screenshot_path = os.path.expanduser("~/aura-screenshot.png")
                proc = await asyncio.create_subprocess_shell(
                    f"screencapture -x {screenshot_path}",
                )
                await proc.wait()
                return ToolResult(success=True, output=f"Screenshot salvo: {screenshot_path}")

            else:
                return ToolResult(success=False, output=None, error=f"Acao desconhecida: {action}")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
