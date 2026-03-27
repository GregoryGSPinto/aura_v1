"""
Browser Navigator — Navegação inteligente baseada em DOM.

Diferente do BrowserTool básico (que executa ações simples),
o Navigator faz um LOOP de navegação:

1. Lê o DOM da página atual (extrai estrutura)
2. Envia pro LLM como texto
3. LLM decide próxima ação
4. Executa ação (clicar, preencher, navegar)
5. Espera página atualizar
6. Volta pro passo 1

Isso é o equivalente textual do que o Cowork faz com screenshots.
"""

import asyncio
import json
import logging
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel
from app.tools.dom_extractor import DOM_EXTRACT_JS, format_dom_for_llm

logger = logging.getLogger("aura")


class BrowserNavigator(BaseTool):
    name = "browser_navigate"
    description = (
        "Navega sites complexos de forma inteligente. Pode completar fluxos multi-passo "
        "como: criar projeto no Supabase, configurar deploy na Vercel, criar PR no GitHub. "
        "Funciona lendo a estrutura da página e decidindo qual ação tomar."
    )
    category = "browser"
    autonomy_level = AutonomyLevel.L2_APPROVAL  # Sempre L2 pois interage com sites
    parameters = {
        "type": "object",
        "properties": {
            "goal": {
                "type": "string",
                "description": "O que fazer no browser. Ex: 'criar novo projeto no Supabase chamado aura-db'"
            },
            "start_url": {
                "type": "string",
                "description": "URL inicial para começar a navegação (opcional se já tem tab aberta)"
            },
            "max_steps": {
                "type": "integer",
                "description": "Máximo de passos de navegação (padrão: 10)"
            },
            "browser": {
                "type": "string",
                "enum": ["chrome", "safari"],
                "description": "Navegador (padrão: chrome)"
            }
        },
        "required": ["goal"]
    }

    async def _applescript(self, script: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode().strip())
        return stdout.decode().strip()

    async def _read_page_dom(self, browser: str) -> dict:
        """Injeta o extractor JS e retorna dados do DOM."""
        app = "Google Chrome" if browser == "chrome" else "Safari"

        # Escapar o JS para AppleScript
        js_escaped = DOM_EXTRACT_JS.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')

        if browser == "chrome":
            raw = await self._applescript(
                f'tell application "{app}" to execute active tab of front window '
                f'javascript "{js_escaped}"'
            )
        else:
            raw = await self._applescript(
                f'tell application "{app}" to do JavaScript "{js_escaped}" in front document'
            )

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"title": "Erro ao ler página", "main_text": raw[:2000], "url": "unknown"}

    async def _execute_page_action(self, action: dict, browser: str) -> str:
        """Executa uma ação na página (clicar, preencher, navegar)."""
        app = "Google Chrome" if browser == "chrome" else "Safari"
        action_type = action.get("action", "")

        if action_type == "click":
            selector = action.get("selector", "")
            js = f"var el = document.querySelector('{selector}'); if(el){{el.click(); 'clicked: {selector}'}} else {{'not found: {selector}'}}"

        elif action_type == "fill":
            selector = action.get("selector", "")
            value = action.get("value", "")
            js = (f"var el = document.querySelector('{selector}'); "
                  f"if(el){{el.value=''; el.focus(); "
                  f"el.value='{value}'; "
                  f"el.dispatchEvent(new Event('input', {{bubbles:true}})); "
                  f"el.dispatchEvent(new Event('change', {{bubbles:true}})); "
                  f"'filled: {selector} = {value}'}} "
                  f"else {{'not found: {selector}'}}")

        elif action_type == "navigate":
            url = action.get("url", "")
            js = f"window.location.href = '{url}'; 'navigating to {url}'"

        elif action_type == "wait":
            await asyncio.sleep(action.get("seconds", 2))
            return "waited"

        elif action_type == "scroll_down":
            js = "window.scrollBy(0, 500); 'scrolled'"

        elif action_type == "scroll_up":
            js = "window.scrollBy(0, -500); 'scrolled up'"

        elif action_type == "select":
            selector = action.get("selector", "")
            value = action.get("value", "")
            js = (f"var el = document.querySelector('{selector}'); "
                  f"if(el){{el.value='{value}'; "
                  f"el.dispatchEvent(new Event('change', {{bubbles:true}})); "
                  f"'selected: {value}'}} else {{'not found'}}")

        elif action_type == "done":
            return "NAVIGATION_COMPLETE"

        else:
            return f"Ação desconhecida: {action_type}"

        js_escaped = js.replace('\\', '\\\\').replace('"', '\\"')

        if browser == "chrome":
            result = await self._applescript(
                f'tell application "{app}" to execute active tab of front window '
                f'javascript "{js_escaped}"'
            )
        else:
            result = await self._applescript(
                f'tell application "{app}" to do JavaScript "{js_escaped}" in front document'
            )

        return result

    async def execute(self, params: dict) -> ToolResult:
        goal = params["goal"]
        start_url = params.get("start_url", "")
        max_steps = min(params.get("max_steps", 10), 15)
        browser = params.get("browser", "chrome")
        app = "Google Chrome" if browser == "chrome" else "Safari"

        steps_log = []

        # Abrir URL inicial se fornecida
        if start_url:
            await self._applescript(f'tell application "{app}" to open location "{start_url}"')
            await self._applescript(f'tell application "{app}" to activate')
            await asyncio.sleep(3)  # Esperar carregamento

        for step in range(max_steps):
            # 1. Ler estado atual da página
            try:
                dom_data = await self._read_page_dom(browser)
                page_description = format_dom_for_llm(dom_data)
            except Exception as e:
                steps_log.append(f"Step {step+1}: Erro ao ler página: {e}")
                await asyncio.sleep(2)
                continue

            # 2. Retornar o estado da página para o LLM decidir
            # O AgentService faz a orquestração do loop externamente.
            steps_log.append(f"Step {step+1}: Lendo página — {dom_data.get('title', 'N/A')}")

            return ToolResult(
                success=True,
                output=json.dumps({
                    "page_state": page_description,
                    "goal": goal,
                    "step": step + 1,
                    "max_steps": max_steps,
                    "instruction": (
                        "Analise o estado da página acima. Para atingir o objetivo, "
                        "responda com a próxima ação usando uma destas tool calls:\n"
                        "- browser action='click' selector='...' -> clicar em elemento\n"
                        "- browser action='fill_input' selector='...' value='...' -> preencher campo\n"
                        "- browser action='open_url' url='...' -> navegar para URL\n"
                        "- browser action='run_javascript' javascript='...' -> executar JS customizado\n"
                        "Se o objetivo foi atingido, diga 'Objetivo concluído' sem tool call."
                    ),
                    "steps_done": steps_log,
                }, ensure_ascii=False)
            )

        return ToolResult(
            success=True,
            output=f"Navegação completada em {len(steps_log)} passos.\n" + "\n".join(steps_log)
        )
