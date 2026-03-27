# AURA — PROMPT SUPLEMENTAR: NAVEGAÇÃO ESTRUTURADA (DOM-Based)

**Complemento ao AURA-MEGA-PROMPT.md**
**Objetivo:** Dar à Aura capacidade de navegar sites complexos (Supabase, Vercel, GitHub) usando Qwen local + leitura do DOM em vez de screenshot visual.

---

## ANTES DE TUDO

- Este prompt DEPENDE do AURA-MEGA-PROMPT.md já estar implementado
- Leia o `backend/app/tools/browser_tool.py` que já existe
- Leia o `backend/app/services/agent_service.py` que já existe
- NÃO quebre nada que já funciona

---

# ═══════════════════════════════════════════════════════════
# MÓDULO A — BROWSER AGENT (navegação inteligente sem visão)
# ═══════════════════════════════════════════════════════════

O Cowork usa screenshots + visão para navegar. A Aura não tem vision no Qwen.
Em vez disso, usa uma técnica diferente:

1. Injeta JavaScript na página que extrai a ESTRUTURA visível (texto + links + botões + inputs + seletores)
2. Envia essa estrutura como TEXTO para o Qwen
3. O Qwen decide qual ação tomar (clicar, preencher, navegar)
4. Executa via JavaScript injection
5. Re-lê a página → loop

Isso funciona porque o Qwen é bom em raciocinar sobre texto estruturado.
É como dar a ele um "mapa" da página em vez de uma foto.

## A.1 — DOM Extractor (os olhos da Aura)

### Crie: `backend/app/tools/dom_extractor.py`

```python
"""
DOM Extractor — Extrai estrutura interativa de páginas web via JavaScript.

Em vez de screenshot (requer visão), extrai:
- Texto visível da página (resumido)
- Todos os links com texto e href
- Todos os botões com texto e seletor
- Todos os inputs/forms com labels e seletores
- Navegação (menu items)
- Mensagens de status/erro

O output é TEXTO que o Qwen/Claude entende e pode agir sobre.
"""

# JavaScript que será injetado na página via AppleScript
DOM_EXTRACT_JS = """
(function() {
    const MAX_TEXT = 3000;
    const result = {
        url: window.location.href,
        title: document.title,
        main_text: '',
        links: [],
        buttons: [],
        inputs: [],
        selects: [],
        navigation: [],
        alerts: [],
        tables: []
    };
    
    // Texto principal (resumido)
    const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
    let text = '';
    while (walker.nextNode() && text.length < MAX_TEXT) {
        const t = walker.currentNode.textContent.trim();
        if (t.length > 2) text += t + ' ';
    }
    result.main_text = text.substring(0, MAX_TEXT);
    
    // Links clicáveis (máximo 30)
    const links = document.querySelectorAll('a[href]');
    for (let i = 0; i < Math.min(links.length, 30); i++) {
        const a = links[i];
        const text = (a.innerText || a.title || a.getAttribute('aria-label') || '').trim();
        if (text && a.offsetParent !== null) {
            let selector = '';
            if (a.id) selector = '#' + a.id;
            else if (a.className) selector = 'a.' + a.className.split(' ')[0];
            else selector = 'a[href="' + a.getAttribute('href') + '"]';
            result.links.push({text: text.substring(0, 80), href: a.href, selector: selector});
        }
    }
    
    // Botões (máximo 20)
    const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
        const btn = buttons[i];
        const text = (btn.innerText || btn.value || btn.title || btn.getAttribute('aria-label') || '').trim();
        if (text && btn.offsetParent !== null) {
            let selector = '';
            if (btn.id) selector = '#' + btn.id;
            else if (btn.getAttribute('data-testid')) selector = '[data-testid="' + btn.getAttribute('data-testid') + '"]';
            else if (btn.className) selector = 'button.' + btn.className.split(' ')[0];
            else selector = 'button:nth-of-type(' + (i+1) + ')';
            
            const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
            result.buttons.push({text: text.substring(0, 60), selector: selector, disabled: disabled});
        }
    }
    
    // Inputs e forms (máximo 15)
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    for (let i = 0; i < Math.min(inputs.length, 15); i++) {
        const inp = inputs[i];
        if (inp.offsetParent === null) continue;
        
        // Encontrar label
        let label = '';
        if (inp.id) {
            const labelEl = document.querySelector('label[for="' + inp.id + '"]');
            if (labelEl) label = labelEl.innerText.trim();
        }
        if (!label) label = inp.placeholder || inp.getAttribute('aria-label') || inp.name || '';
        
        let selector = '';
        if (inp.id) selector = '#' + inp.id;
        else if (inp.name) selector = '[name="' + inp.name + '"]';
        else selector = inp.tagName.toLowerCase() + ':nth-of-type(' + (i+1) + ')';
        
        const info = {
            label: label.substring(0, 60),
            type: inp.type || inp.tagName.toLowerCase(),
            selector: selector,
            value: inp.value ? inp.value.substring(0, 50) : '',
            required: inp.required
        };
        
        // Para select, incluir opções
        if (inp.tagName === 'SELECT') {
            info.options = Array.from(inp.options).map(o => o.text).slice(0, 10);
        }
        
        result.inputs.push(info);
    }
    
    // Navigation items
    const navs = document.querySelectorAll('nav a, [role="navigation"] a, [role="menuitem"]');
    for (let i = 0; i < Math.min(navs.length, 15); i++) {
        const nav = navs[i];
        const text = (nav.innerText || '').trim();
        if (text) {
            const active = nav.classList.contains('active') || nav.getAttribute('aria-current') === 'page';
            result.navigation.push({text: text.substring(0, 40), active: active});
        }
    }
    
    // Alerts e mensagens de status
    const alerts = document.querySelectorAll('[role="alert"], .alert, .error, .success, .warning, .toast, [class*="notification"]');
    for (let i = 0; i < Math.min(alerts.length, 5); i++) {
        const text = (alerts[i].innerText || '').trim();
        if (text) result.alerts.push(text.substring(0, 200));
    }
    
    // Tabelas (resumo)
    const tables = document.querySelectorAll('table');
    for (let i = 0; i < Math.min(tables.length, 3); i++) {
        const table = tables[i];
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean);
        const rowCount = table.querySelectorAll('tbody tr').length;
        if (headers.length > 0) {
            result.tables.push({headers: headers, row_count: rowCount});
        }
    }
    
    return JSON.stringify(result);
})()
"""


def format_dom_for_llm(dom_data: dict) -> str:
    """
    Formata os dados do DOM como texto estruturado que o LLM entende.
    Este é o 'screenshot textual' da Aura.
    """
    lines = []
    lines.append(f"=== PÁGINA: {dom_data.get('title', 'Sem título')} ===")
    lines.append(f"URL: {dom_data.get('url', '')}")
    lines.append("")
    
    # Alertas/erros primeiro (são importantes)
    alerts = dom_data.get('alerts', [])
    if alerts:
        lines.append("⚠️ ALERTAS:")
        for alert in alerts:
            lines.append(f"  - {alert}")
        lines.append("")
    
    # Navegação
    nav = dom_data.get('navigation', [])
    if nav:
        nav_items = [f"{'[ATIVO] ' if n.get('active') else ''}{n['text']}" for n in nav]
        lines.append(f"📍 NAVEGAÇÃO: {' | '.join(nav_items)}")
        lines.append("")
    
    # Texto principal (resumido)
    text = dom_data.get('main_text', '')
    if text:
        lines.append("📄 CONTEÚDO:")
        # Limitar a 1500 chars para não estourar contexto
        lines.append(f"  {text[:1500]}")
        lines.append("")
    
    # Tabelas
    tables = dom_data.get('tables', [])
    if tables:
        lines.append("📊 TABELAS:")
        for t in tables:
            lines.append(f"  Colunas: {', '.join(t['headers'])} ({t['row_count']} linhas)")
        lines.append("")
    
    # Inputs
    inputs = dom_data.get('inputs', [])
    if inputs:
        lines.append("📝 CAMPOS PREENCHÍVEIS:")
        for inp in inputs:
            req = " (obrigatório)" if inp.get('required') else ""
            val = f" [valor atual: {inp['value']}]" if inp.get('value') else ""
            lines.append(f"  - [{inp['type']}] {inp['label']}{req}{val}")
            lines.append(f"    seletor: {inp['selector']}")
            if inp.get('options'):
                lines.append(f"    opções: {', '.join(inp['options'])}")
        lines.append("")
    
    # Botões
    buttons = dom_data.get('buttons', [])
    if buttons:
        lines.append("🔘 BOTÕES:")
        for btn in buttons:
            disabled = " (desabilitado)" if btn.get('disabled') else ""
            lines.append(f"  - \"{btn['text']}\"{disabled}")
            lines.append(f"    seletor: {btn['selector']}")
        lines.append("")
    
    # Links (primeiros 15)
    links = dom_data.get('links', [])
    if links:
        lines.append("🔗 LINKS:")
        for link in links[:15]:
            lines.append(f"  - \"{link['text']}\" → {link['href'][:80]}")
            lines.append(f"    seletor: {link['selector']}")
        if len(links) > 15:
            lines.append(f"  ... e mais {len(links) - 15} links")
        lines.append("")
    
    return "\n".join(lines)
```

---

## A.2 — Browser Navigator Tool (evolução do BrowserTool)

### Crie: `backend/app/tools/browser_navigator.py`

```python
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
import time
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
            
            # 2. Pedir ao LLM a próxima ação
            # NOTA: Este método precisa de acesso ao brain_router.
            # Como tool não tem acesso direto, retornamos o DOM pro AgentService
            # que faz o loop externamente.
            # 
            # Em vez de fazer o loop aqui dentro, retornamos a estrutura da página
            # para que o AgentService faça a orquestração.
            
            steps_log.append(f"Step {step+1}: Lendo página — {dom_data.get('title', 'N/A')}")
            
            # Retornar o estado da página para o LLM decidir
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
                        "- browser action='click' selector='...' → clicar em elemento\n"
                        "- browser action='fill_input' selector='...' value='...' → preencher campo\n"
                        "- browser action='open_url' url='...' → navegar para URL\n"
                        "- browser action='run_javascript' javascript='...' → executar JS customizado\n"
                        "Se o objetivo foi atingido, diga 'Objetivo concluído' sem tool call."
                    ),
                    "steps_done": steps_log,
                }, ensure_ascii=False)
            )
        
        return ToolResult(
            success=True,
            output=f"Navegação completada em {len(steps_log)} passos.\n" + "\n".join(steps_log)
        )
```

---

## A.3 — Workflow Templates (atalhos para sites comuns)

### Crie: `backend/app/tools/web_workflows.py`

```python
"""
Web Workflows — Templates pré-definidos para sites que o Gregory usa.

Em vez de navegar genericamente (lento, frágil), estes workflows
sabem exatamente os seletores e URLs de cada site.

Pense neles como "macros" — o Gregory diz "cria projeto no Supabase"
e o workflow sabe exatamente quais URLs abrir e o que preencher.
"""

import asyncio
import os
import json
import logging
from typing import Optional, Dict

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel

logger = logging.getLogger("aura")


# Templates de workflows por site
SITE_WORKFLOWS = {
    "github": {
        "base_url": "https://github.com",
        "workflows": {
            "create_repo": {
                "description": "Cria repositório no GitHub",
                "url": "https://github.com/new",
                "steps_description": (
                    "Para criar um repositório no GitHub:\n"
                    "1. Abra https://github.com/new no Chrome\n"
                    "2. Preencha o campo 'Repository name' (seletor: #repository_name ou input[name='repository[name]'])\n"
                    "3. Selecione visibilidade: Private (seletor: #repository_visibility_private)\n"
                    "4. Clique 'Create repository' (seletor: button[type='submit'] com texto 'Create repository')\n"
                    "5. Verifique se a URL mudou para github.com/USER/REPO"
                )
            },
            "create_pr": {
                "description": "Cria Pull Request no GitHub",
                "steps_description": (
                    "Para criar um PR:\n"
                    "1. Navegue até o repositório\n"
                    "2. Clique na tab 'Pull requests'\n"
                    "3. Clique 'New pull request'\n"
                    "4. Selecione as branches\n"
                    "5. Preencha título e descrição\n"
                    "6. Clique 'Create pull request'"
                )
            }
        }
    },
    "vercel": {
        "base_url": "https://vercel.com",
        "workflows": {
            "check_deploy": {
                "description": "Verifica status do último deploy na Vercel",
                "url": "https://vercel.com/dashboard",
                "steps_description": (
                    "Para verificar deploy:\n"
                    "1. Abra https://vercel.com/dashboard\n"
                    "2. Leia a lista de projetos e seus status\n"
                    "3. Procure pelo projeto específico\n"
                    "4. Verifique se o status é 'Ready' (verde) ou 'Error' (vermelho)"
                )
            },
            "new_project": {
                "description": "Importa novo projeto na Vercel",
                "url": "https://vercel.com/new",
                "steps_description": (
                    "Para importar projeto:\n"
                    "1. Abra https://vercel.com/new\n"
                    "2. Selecione repositório do GitHub\n"
                    "3. Configure Root Directory, Build Command, Output Directory\n"
                    "4. Clique Deploy"
                )
            }
        }
    },
    "supabase": {
        "base_url": "https://supabase.com",
        "workflows": {
            "create_project": {
                "description": "Cria novo projeto no Supabase",
                "url": "https://supabase.com/dashboard/new",
                "steps_description": (
                    "Para criar projeto Supabase:\n"
                    "1. Abra https://supabase.com/dashboard/new\n"
                    "2. Preencha 'Project name'\n"
                    "3. Gere database password\n"
                    "4. Selecione região (South America se disponível)\n"
                    "5. Clique 'Create new project'\n"
                    "6. Aguarde provisionamento (~2 minutos)"
                )
            },
            "sql_editor": {
                "description": "Abre o SQL Editor do Supabase",
                "url": "https://supabase.com/dashboard/project/_/sql",
                "steps_description": (
                    "Para usar SQL Editor:\n"
                    "1. Abra o dashboard do projeto\n"
                    "2. Clique em 'SQL Editor' no menu lateral\n"
                    "3. Digite a query SQL\n"
                    "4. Clique 'Run' ou Ctrl+Enter"
                )
            }
        }
    }
}


class WebWorkflowTool(BaseTool):
    name = "web_workflow"
    description = (
        "Executa workflows pré-definidos em sites comuns: GitHub (criar repo, criar PR), "
        "Vercel (verificar deploy, importar projeto), Supabase (criar projeto, SQL editor). "
        "Use este tool quando Gregory pedir algo específico desses sites."
    )
    category = "browser"
    autonomy_level = AutonomyLevel.L2_APPROVAL
    parameters = {
        "type": "object",
        "properties": {
            "site": {
                "type": "string",
                "enum": ["github", "vercel", "supabase"],
                "description": "Site alvo"
            },
            "workflow": {
                "type": "string",
                "description": "Workflow a executar (ex: create_repo, check_deploy, create_project)"
            },
            "params": {
                "type": "object",
                "description": "Parâmetros do workflow (ex: {name: 'meu-repo', private: true})"
            }
        },
        "required": ["site", "workflow"]
    }

    async def execute(self, params: dict) -> ToolResult:
        site = params["site"]
        workflow_name = params["workflow"]
        workflow_params = params.get("params", {})

        site_config = SITE_WORKFLOWS.get(site)
        if not site_config:
            return ToolResult(success=False, output=None,
                              error=f"Site não configurado: {site}")

        workflow = site_config["workflows"].get(workflow_name)
        if not workflow:
            available = list(site_config["workflows"].keys())
            return ToolResult(success=False, output=None,
                              error=f"Workflow '{workflow_name}' não existe para {site}. Disponíveis: {available}")

        # Retornar as instruções de navegação para o LLM executar
        # O LLM vai usar browser tool (open_url, click, fill) para executar cada passo
        output = {
            "site": site,
            "workflow": workflow_name,
            "description": workflow["description"],
            "start_url": workflow.get("url", site_config["base_url"]),
            "navigation_guide": workflow["steps_description"],
            "params": workflow_params,
            "instruction": (
                f"Para completar este workflow no {site}:\n\n"
                f"{workflow['steps_description']}\n\n"
                f"Use as ferramentas 'browser' (open_url, get_page_content, click_element, fill_input) "
                f"para executar cada passo. Comece abrindo a URL: {workflow.get('url', site_config['base_url'])}\n\n"
                f"Parâmetros fornecidos: {json.dumps(workflow_params, ensure_ascii=False)}"
            )
        }

        return ToolResult(
            success=True,
            output=json.dumps(output, ensure_ascii=False, indent=2)
        )
```

---

## A.4 — Registrar novas tools

### Modifique: `backend/app/tools/__init__.py`

Adicione ao `create_tool_registry()`:

```python
from app.tools.browser_navigator import BrowserNavigator
from app.tools.web_workflows import WebWorkflowTool

# Dentro de create_tool_registry(), adicionar:
registry.register(BrowserNavigator())
registry.register(WebWorkflowTool())
```

---

## A.5 — Attachment Tool (leitura de arquivos anexados)

### Crie: `backend/app/tools/attachment_tool.py`

```python
"""
Attachment Tool — Processa arquivos que Gregory envia pelo chat.

Suporta:
- Imagens: salva e retorna path (não processa visão)
- PDFs: extrai texto
- Documentos: extrai texto (txt, md, csv, json, py, js, ts, etc)
- Áudio: transcreve via STT (se disponível)
- Zip: lista conteúdo

O Gregory pode arrastar arquivo no chat ou enviar por voz "analisa esse arquivo".
O frontend faz upload pro backend, que usa este tool para processar.
"""

import os
import json
import mimetypes
from pathlib import Path
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


UPLOAD_DIR = os.path.expanduser("~/Projetos/aura_v1/aura/data/uploads")
TEXT_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json", ".py", ".js", ".ts", ".tsx",
    ".jsx", ".html", ".css", ".yaml", ".yml", ".toml", ".sh",
    ".bash", ".sql", ".xml", ".ini", ".conf", ".log", ".env.example",
}


class AttachmentTool(BaseTool):
    name = "attachment"
    description = "Processa arquivos enviados pelo Gregory: extrai texto de PDFs, lê documentos, lista ZIPs, etc."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Caminho do arquivo enviado"
            },
            "action": {
                "type": "string",
                "enum": ["read", "info", "extract_text"],
                "description": "Ação: read (conteúdo), info (metadata), extract_text (PDF/doc)"
            }
        },
        "required": ["file_path"]
    }

    async def execute(self, params: dict) -> ToolResult:
        file_path = params["file_path"]
        action = params.get("action", "read")

        if not os.path.exists(file_path):
            return ToolResult(success=False, output=None,
                              error=f"Arquivo não encontrado: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        size = os.path.getsize(file_path)
        mime = mimetypes.guess_type(file_path)[0] or "unknown"

        if action == "info":
            return ToolResult(success=True, output=json.dumps({
                "path": file_path,
                "name": os.path.basename(file_path),
                "extension": ext,
                "size_bytes": size,
                "size_human": f"{size//1024}KB" if size > 1024 else f"{size}B",
                "mime_type": mime,
            }))

        # Ler conteúdo baseado no tipo
        try:
            if ext in TEXT_EXTENSIONS:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                if len(content) > 100000:
                    content = content[:100000] + "\n\n[...TRUNCADO]"
                return ToolResult(success=True,
                                  output=f"Arquivo: {os.path.basename(file_path)} ({len(content)} chars)\n\n{content}")

            elif ext == ".pdf":
                # Tentar extrair texto com pdftotext ou PyPDF2
                import asyncio
                proc = await asyncio.create_subprocess_shell(
                    f'pdftotext "{file_path}" -',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                text = stdout.decode("utf-8", errors="replace")
                if text.strip():
                    return ToolResult(success=True,
                                      output=f"PDF: {os.path.basename(file_path)}\n\n{text[:100000]}")
                return ToolResult(success=True,
                                  output="PDF sem texto extraível (pode ser scan/imagem)")

            elif ext == ".zip":
                import zipfile
                with zipfile.ZipFile(file_path, 'r') as z:
                    files = z.namelist()
                return ToolResult(success=True,
                                  output=f"ZIP com {len(files)} arquivos:\n" + "\n".join(files[:50]))

            elif ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
                return ToolResult(success=True,
                                  output=f"Imagem: {os.path.basename(file_path)} ({size//1024}KB, {mime}). "
                                         f"Salva em: {file_path}. "
                                         f"Nota: Qwen local não processa imagens. Use Claude API para análise visual.")

            else:
                return ToolResult(success=True,
                                  output=f"Arquivo: {os.path.basename(file_path)} ({ext}, {size//1024}KB). "
                                         f"Tipo não suportado para leitura direta.")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

### Adicionar ao `__init__.py`:
```python
from app.tools.attachment_tool import AttachmentTool
registry.register(AttachmentTool())
```

---

## A.6 — Upload Endpoint

### Crie: `backend/app/api/v1/endpoints/upload_api.py`

```python
"""Upload API — Recebe arquivos do frontend."""

import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import require_bearer_token

router = APIRouter(prefix="/upload", dependencies=[Depends(require_bearer_token)])

UPLOAD_DIR = os.path.expanduser("~/Projetos/aura_v1/aura/data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    """Recebe arquivo e salva no disco."""
    ext = os.path.splitext(file.filename or "")[1]
    safe_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"
    save_path = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    return {
        "path": save_path,
        "original_name": file.filename,
        "size_bytes": len(content),
        "content_type": file.content_type,
    }
```

### Registrar no main.py:
```python
from app.api.v1.endpoints.upload_api import router as upload_router
app.include_router(upload_router, prefix="/api/v1")
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO B — FRONTEND: UPLOAD + ATTACHMENT PREVIEW
# ═══════════════════════════════════════════════════════════

### Modifique: `frontend/components/chat/chat-composer.tsx`

Adicione botão de anexar arquivo (clip icon) ao lado do botão de voz:
- Tap → abre seletor de arquivo (aceitar: .pdf, .txt, .md, .py, .js, .ts, .json, .csv, .zip, imagens)
- Arquivo selecionado → upload via POST /api/v1/upload
- Após upload → enviar mensagem automática pro agent: "Analisa o arquivo {nome} que acabei de enviar" com o path do arquivo
- Preview do arquivo selecionado antes de enviar (nome + tamanho + ícone por tipo)

### Crie: `frontend/components/chat/AttachmentPreview.tsx`

Card compacto mostrando arquivo selecionado:
- Ícone por tipo (📄 texto, 📊 PDF, 🖼️ imagem, 📦 ZIP)
- Nome do arquivo
- Tamanho
- Botão X para remover
- Estilo: glassmorphism, borda sutil, inline no composer

---

# ═══════════════════════════════════════════════════════════
# TESTES FINAIS
# ═══════════════════════════════════════════════════════════

### Teste A1 — DOM Extractor:
```bash
python3 -c "
from app.tools.dom_extractor import format_dom_for_llm
test_dom = {
    'title': 'Vercel Dashboard',
    'url': 'https://vercel.com/dashboard',
    'main_text': 'Your projects are ready...',
    'buttons': [{'text': 'Add New', 'selector': 'button.add', 'disabled': False}],
    'links': [{'text': 'aura-v1', 'href': 'https://vercel.com/aura-v1', 'selector': 'a.project'}],
    'inputs': [],
    'navigation': [{'text': 'Overview', 'active': True}, {'text': 'Settings', 'active': False}],
    'alerts': [],
    'tables': []
}
print(format_dom_for_llm(test_dom))
"
```
Esperado: output formatado legível

### Teste A2 — Web Workflow:
```bash
python3 -c "
import asyncio
from app.tools.web_workflows import WebWorkflowTool
tool = WebWorkflowTool()
result = asyncio.run(tool.execute({
    'site': 'github',
    'workflow': 'create_repo',
    'params': {'name': 'test-repo'}
}))
print(result.output[:500])
"
```
Esperado: retorna instruções de navegação

### Teste A3 — Attachment:
```bash
echo "Hello Aura" > /tmp/test-attachment.txt
python3 -c "
import asyncio
from app.tools.attachment_tool import AttachmentTool
tool = AttachmentTool()
result = asyncio.run(tool.execute({'file_path': '/tmp/test-attachment.txt', 'action': 'read'}))
print(result.output)
"
```
Esperado: conteúdo do arquivo

### Teste A4 — Tools totais registradas:
```bash
python3 -c "
from app.tools import create_tool_registry
registry = create_tool_registry()
tools = registry.list_tools()
print(f'Total: {len(tools)} tools')
for t in tools:
    print(f'  {t[\"name\"]}: L{t[\"autonomy_level\"]}')
"
```
Esperado: 13 tools (10 originais + browser_navigate + web_workflow + attachment)

### Teste A5 — Agent com navegação:
```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AURA_TOKEN" \
  -d '{"message": "abre o github.com no chrome e me diz o que aparece na página"}'
```
Esperado: abre Chrome, lê DOM, descreve a página

### Teste A6 — Frontend build:
```bash
cd ~/Projetos/aura_v1/aura/frontend
pnpm tsc --noEmit && pnpm build
```

### Teste A7 — Commit e deploy:
```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "feat: browser navigator + DOM extractor + web workflows + attachments"
git push
```

---

# REGRAS

1. Este prompt é SUPLEMENTAR — rode DEPOIS do AURA-MEGA-PROMPT.md
2. NÃO quebre nada que já existe
3. NÃO instale Playwright/Puppeteer — use AppleScript (leve, funciona com Chrome/Safari do Mac)
4. Se o DOM extractor falhar em algum site, retorne erro graceful — não quebre o agent loop
5. Web Workflows são GUIAS para o LLM, não automação rígida — o LLM usa browser tool para executar cada passo
6. Timeout de 30s por ação de browser
7. Toda ação de browser que interage (click, fill) é L2 — precisa aprovação
8. Login/credenciais são SEMPRE L3 — nunca automatizar
9. Rode TODOS os testes no final
