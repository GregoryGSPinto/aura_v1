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
        lines.append("ALERTAS:")
        for alert in alerts:
            lines.append(f"  - {alert}")
        lines.append("")

    # Navegação
    nav = dom_data.get('navigation', [])
    if nav:
        nav_items = [f"{'[ATIVO] ' if n.get('active') else ''}{n['text']}" for n in nav]
        lines.append(f"NAVEGACAO: {' | '.join(nav_items)}")
        lines.append("")

    # Texto principal (resumido)
    text = dom_data.get('main_text', '')
    if text:
        lines.append("CONTEUDO:")
        # Limitar a 1500 chars para não estourar contexto
        lines.append(f"  {text[:1500]}")
        lines.append("")

    # Tabelas
    tables = dom_data.get('tables', [])
    if tables:
        lines.append("TABELAS:")
        for t in tables:
            lines.append(f"  Colunas: {', '.join(t['headers'])} ({t['row_count']} linhas)")
        lines.append("")

    # Inputs
    inputs = dom_data.get('inputs', [])
    if inputs:
        lines.append("CAMPOS PREENCHÍVEIS:")
        for inp in inputs:
            req = " (obrigatório)" if inp.get('required') else ""
            val = f" [valor atual: {inp['value']}]" if inp.get('value') else ""
            lines.append(f"  - [{inp['type']}] {inp['label']}{req}{val}")
            lines.append(f"    seletor: {inp['selector']}")
            if inp.get('options'):
                lines.append(f"    opcoes: {', '.join(inp['options'])}")
        lines.append("")

    # Botões
    buttons = dom_data.get('buttons', [])
    if buttons:
        lines.append("BOTOES:")
        for btn in buttons:
            disabled = " (desabilitado)" if btn.get('disabled') else ""
            lines.append(f"  - \"{btn['text']}\"{disabled}")
            lines.append(f"    seletor: {btn['selector']}")
        lines.append("")

    # Links (primeiros 15)
    links = dom_data.get('links', [])
    if links:
        lines.append("LINKS:")
        for link in links[:15]:
            lines.append(f"  - \"{link['text']}\" -> {link['href'][:80]}")
            lines.append(f"    seletor: {link['selector']}")
        if len(links) > 15:
            lines.append(f"  ... e mais {len(links) - 15} links")
        lines.append("")

    return "\n".join(lines)
