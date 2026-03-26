"""
Tool Schema Service — Descreve as tools disponíveis pro LLM.
"""

import logging
from typing import Optional

logger = logging.getLogger("aura")


class ToolSchemaService:
    def __init__(self, tool_router=None, action_governance=None, permissions_policy=None):
        self.router = tool_router
        self.governance = action_governance
        self.permissions = permissions_policy

    def get_available_tools(self) -> list:
        tools = [
            {
                "name": "claude.execute",
                "description": "Envia um prompt para o Claude Code CLI e retorna o resultado. Usa para tarefas complexas de código, análise, commits, deploys.",
                "parameters": {
                    "prompt": {"type": "string", "description": "Prompt a enviar para o Claude Code", "required": True},
                    "working_dir": {"type": "string", "description": "Diretório de trabalho (default: aura_v1)", "required": False},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
                "examples": ["Analisa o código do backend e sugere melhorias", "Faz commit das mudanças com mensagem descritiva"],
            },
            {
                "name": "claude.create_mission",
                "description": "Cria e executa uma missão estruturada via Claude Code CLI com tracking de status, output parsing e retry automático.",
                "parameters": {
                    "objective": {"type": "string", "description": "Objetivo da missão (ex: 'Corrigir bug no login')", "required": True},
                    "project_slug": {"type": "string", "description": "Slug do projeto alvo", "required": True},
                    "working_dir": {"type": "string", "description": "Diretório de trabalho", "required": False},
                    "context": {"type": "string", "description": "Contexto adicional para a missão", "required": False},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
                "examples": ["Criar missão para refatorar o módulo de auth", "Missão: adicionar testes unitários ao service X"],
            },
            {
                "name": "terminal.execute",
                "description": "Executa um comando no terminal do Mac. Apenas comandos da whitelist.",
                "parameters": {"command": {"type": "string", "description": "Comando a executar", "required": True}},
                "risk_level": "high",
                "requires_confirmation": True,
                "examples": ["git status", "ls -la", "npm run build"],
            },
            {
                "name": "filesystem.read",
                "description": "Lê o conteúdo de um arquivo.",
                "parameters": {"path": {"type": "string", "description": "Caminho do arquivo", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "filesystem.list",
                "description": "Lista arquivos e pastas de um diretório.",
                "parameters": {"path": {"type": "string", "description": "Caminho do diretório", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "filesystem.write",
                "description": "Escreve conteúdo em um arquivo.",
                "parameters": {
                    "path": {"type": "string", "description": "Caminho do arquivo", "required": True},
                    "content": {"type": "string", "description": "Conteúdo a escrever", "required": True},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
            },
            {
                "name": "browser.open",
                "description": "Abre uma URL no navegador padrão.",
                "parameters": {"url": {"type": "string", "description": "URL completa", "required": True}},
                "risk_level": "moderate",
                "requires_confirmation": False,
            },
            {
                "name": "vscode.open_project",
                "description": "Abre um projeto no Visual Studio Code.",
                "parameters": {"project": {"type": "string", "description": "Nome ou path do projeto", "required": True}},
                "risk_level": "moderate",
                "requires_confirmation": False,
            },
            {
                "name": "project.list",
                "description": "Lista todos os projetos conhecidos pela Aura.",
                "parameters": {},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "project.status",
                "description": "Mostra status de um projeto (git status, última atividade).",
                "parameters": {"project": {"type": "string", "description": "Nome do projeto", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "system.summary",
                "description": "Mostra status do sistema (CPU, RAM, disco, processos).",
                "parameters": {},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            # Sprint 4: Git tools
            {
                "name": "git.status",
                "description": "Mostra o status do repositório Git (arquivos modificados, branch atual).",
                "parameters": {"repo_path": {"type": "string", "description": "Caminho do repositório", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "git.log",
                "description": "Mostra os últimos commits do repositório.",
                "parameters": {
                    "repo_path": {"type": "string", "description": "Caminho do repositório", "required": True},
                    "limit": {"type": "integer", "description": "Número de commits", "default": 10},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "git.diff",
                "description": "Mostra as diferenças (diff) no repositório.",
                "parameters": {
                    "repo_path": {"type": "string", "description": "Caminho do repositório", "required": True},
                    "file": {"type": "string", "description": "Arquivo específico (opcional)", "required": False},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "git.branch",
                "description": "Lista branches do repositório.",
                "parameters": {"repo_path": {"type": "string", "description": "Caminho do repositório", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "git.add",
                "description": "Adiciona arquivos ao staging area do Git.",
                "parameters": {
                    "repo_path": {"type": "string", "description": "Caminho do repositório", "required": True},
                    "files": {"type": "array", "description": "Lista de arquivos (default: todos)", "required": False},
                },
                "risk_level": "moderate",
                "requires_confirmation": True,
            },
            {
                "name": "git.commit",
                "description": "Cria um commit com mensagem.",
                "parameters": {
                    "repo_path": {"type": "string", "description": "Caminho do repositório", "required": True},
                    "message": {"type": "string", "description": "Mensagem do commit", "required": True},
                },
                "risk_level": "moderate",
                "requires_confirmation": True,
            },
            {
                "name": "git.push",
                "description": "Envia commits para o repositório remoto.",
                "parameters": {
                    "repo_path": {"type": "string", "description": "Caminho do repositório", "required": True},
                    "branch": {"type": "string", "description": "Branch (opcional)", "required": False},
                },
                "risk_level": "moderate",
                "requires_confirmation": True,
            },
            # Sprint 4: Browser tools
            {
                "name": "browser.fetch_url",
                "description": "Faz GET em uma URL e retorna o conteúdo (HTML/JSON).",
                "parameters": {"url": {"type": "string", "description": "URL completa", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "browser.check_url",
                "description": "Verifica se uma URL está online e retorna status code.",
                "parameters": {"url": {"type": "string", "description": "URL completa", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "browser.extract_text",
                "description": "Extrai o texto principal de uma página web.",
                "parameters": {"url": {"type": "string", "description": "URL completa", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            # Sprint 4: Doc tools
            {
                "name": "doc.read_doc",
                "description": "Lê o conteúdo de um arquivo de texto/código.",
                "parameters": {"path": {"type": "string", "description": "Caminho do arquivo", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "doc.search_in_doc",
                "description": "Busca texto dentro de um arquivo.",
                "parameters": {
                    "path": {"type": "string", "description": "Caminho do arquivo", "required": True},
                    "query": {"type": "string", "description": "Texto a buscar", "required": True},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            # Sprint 4: Filesystem write operations
            {
                "name": "filesystem.write_file",
                "description": "Escreve conteúdo em um arquivo (cria ou sobrescreve).",
                "parameters": {
                    "path": {"type": "string", "description": "Caminho do arquivo", "required": True},
                    "content": {"type": "string", "description": "Conteúdo a escrever", "required": True},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
            },
            {
                "name": "filesystem.delete_file",
                "description": "Deleta um arquivo.",
                "parameters": {"path": {"type": "string", "description": "Caminho do arquivo", "required": True}},
                "risk_level": "critical",
                "requires_confirmation": True,
            },
            {
                "name": "research.search",
                "description": "Pesquisa na web e resume resultados.",
                "parameters": {
                    "query": {"type": "string", "description": "O que pesquisar", "required": True},
                    "max_results": {"type": "integer", "description": "Máximo de resultados", "default": 5},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "github.repos",
                "description": "Lista repositórios do Gregory no GitHub.",
                "parameters": {},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "github.issues",
                "description": "Lista issues abertas de um repositório GitHub.",
                "parameters": {"repo": {"type": "string", "description": "Nome do repositório", "required": True}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "calendar.today",
                "description": "Mostra eventos da agenda de hoje.",
                "parameters": {},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "gmail.unread",
                "description": "Mostra emails não lidos.",
                "parameters": {"limit": {"type": "integer", "description": "Limite", "default": 5}},
                "risk_level": "low",
                "requires_confirmation": False,
            },
            # AuraDev tools
            {
                "name": "auradev.task",
                "description": "Executa uma tarefa de desenvolvimento de código. Auto-roteia entre Qwen (local, rápido, simples) e Claude Code (complexo, multi-arquivo). Usa para gerar código, refatorar, criar funções/componentes.",
                "parameters": {
                    "task": {"type": "string", "description": "Descrição da tarefa de dev", "required": True},
                    "project": {"type": "string", "description": "Nome do projeto em ~/Projetos (ex: 'aura_v1')", "required": False},
                    "provider": {"type": "string", "description": "'qwen' ou 'claude' (default: auto)", "required": False},
                },
                "risk_level": "elevated",
                "requires_confirmation": False,
                "examples": [
                    "Cria uma função para validar CPF",
                    "Refatora o módulo de autenticação",
                    "Gera um hook React para dark mode",
                ],
            },
            {
                "name": "auradev.fix",
                "description": "Corrige um erro a partir de um traceback/mensagem de erro e arquivo.",
                "parameters": {
                    "error_message": {"type": "string", "description": "Traceback ou mensagem de erro", "required": True},
                    "file_path": {"type": "string", "description": "Caminho do arquivo com erro", "required": True},
                    "project": {"type": "string", "description": "Nome do projeto", "required": False},
                },
                "risk_level": "elevated",
                "requires_confirmation": False,
            },
            {
                "name": "auradev.review",
                "description": "Faz code review profundo de um arquivo (sempre usa Claude).",
                "parameters": {
                    "file_path": {"type": "string", "description": "Caminho do arquivo para review", "required": True},
                    "project": {"type": "string", "description": "Nome do projeto", "required": False},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            {
                "name": "auradev.tests",
                "description": "Gera testes automatizados (pytest/Jest) para um arquivo.",
                "parameters": {
                    "file_path": {"type": "string", "description": "Caminho do arquivo para gerar testes", "required": True},
                    "project": {"type": "string", "description": "Nome do projeto", "required": False},
                },
                "risk_level": "low",
                "requires_confirmation": False,
            },
            # Sprint 5: Claude Code Mission
            {
                "name": "claude_code",
                "description": "Cria e executa uma missão estruturada via Claude Code CLI. Usa para tarefas complexas de desenvolvimento: corrigir bugs, criar componentes, refatorar, fazer deploy.",
                "parameters": {
                    "objective": {"type": "string", "description": "Objetivo da missão (ex: 'Corrigir bug no login')", "required": True},
                    "project": {"type": "string", "description": "Slug do projeto alvo (ex: 'aura')", "required": True},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
                "examples": ["Corrigir sidebar esquerda", "Criar componente de settings", "Refatorar módulo de auth"],
            },
        ]
        return [t for t in tools if self._is_allowed(t["name"])]

    def _is_allowed(self, tool_name: str) -> bool:
        return True  # All tools allowed; security handled at execution

    def get_tools_prompt_block(self) -> str:
        tools = self.get_available_tools()

        # Build compact tool list
        tool_list_lines = []
        for tool in tools:
            params_parts = []
            if tool.get("parameters") and isinstance(tool["parameters"], dict):
                for k, v in tool["parameters"].items():
                    if isinstance(v, dict):
                        req = "obrigatório" if v.get("required") else "opcional"
                        params_parts.append(f"{k} ({req})")
            params_str = ", ".join(params_parts) if params_parts else "nenhum"
            tool_list_lines.append(f"- {tool['name']}: {tool['description']} | Params: {params_str}")

        tool_list = "\n".join(tool_list_lines)

        block = f"""<tools_disponiveis>

## INSTRUÇÕES DE USO DE FERRAMENTAS

Você tem acesso a ferramentas. Quando o usuário pedir algo que REQUER uma ferramenta (ver lista abaixo), você DEVE usar a ferramenta.

### FORMATO OBRIGATÓRIO

Para usar uma ferramenta, inclua na sua resposta um bloco EXATAMENTE assim:

<tool_call>
{{"tool": "nome.da.ferramenta", "params": {{"chave": "valor"}}, "reason": "motivo"}}
</tool_call>

REGRAS CRÍTICAS:
1. O bloco <tool_call> DEVE conter JSON válido com as chaves "tool" e "params".
2. O nome da ferramenta DEVE ser exatamente igual ao da lista abaixo.
3. Você pode escrever texto ANTES do bloco <tool_call>, mas o bloco deve estar presente.
4. Após receber o <tool_result>, use os dados reais para responder. NUNCA invente dados.
5. NUNCA responda com dados inventados. Se não tem a informação, use a ferramenta.

### EXEMPLOS CONCRETOS

Exemplo 1 — usuário pede "qual o status do git do projeto aura":
Vou verificar o status do Git para você.
<tool_call>
{{"tool": "git.status", "params": {{"repo_path": "/Users/user_pc/Projetos/aura_v1"}}, "reason": "ver status git"}}
</tool_call>

Exemplo 2 — usuário pede "lista os arquivos da pasta backend":
<tool_call>
{{"tool": "filesystem.list", "params": {{"path": "/Users/user_pc/Projetos/aura_v1/aura/backend"}}, "reason": "listar diretório"}}
</tool_call>

Exemplo 3 — usuário pede "roda git log do aura":
<tool_call>
{{"tool": "git.log", "params": {{"repo_path": "/Users/user_pc/Projetos/aura_v1", "limit": 10}}, "reason": "ver commits recentes"}}
</tool_call>

Exemplo 4 — usuário pede "verifica se google.com está online":
<tool_call>
{{"tool": "browser.check_url", "params": {{"url": "https://google.com"}}, "reason": "checar se URL está online"}}
</tool_call>

Exemplo 5 — usuário pede "lê o arquivo README.md":
<tool_call>
{{"tool": "doc.read_doc", "params": {{"path": "/Users/user_pc/Projetos/aura_v1/README.md"}}, "reason": "ler conteúdo do arquivo"}}
</tool_call>

Exemplo 6 — usuário pede "executa npm run build":
<tool_call>
{{"tool": "terminal.execute", "params": {{"command": "npm run build"}}, "reason": "executar build"}}
</tool_call>

### QUANDO USAR FERRAMENTAS vs RESPONDER DIRETO

USA ferramenta quando:
- O usuário pede para VER, LER, LISTAR, VERIFICAR algo no sistema
- O usuário pede para EXECUTAR um comando
- O usuário pede informações que só existem no sistema (arquivos, git, projetos)

NÃO usa ferramenta quando:
- O usuário faz uma pergunta de conhecimento geral ("o que é Python?")
- O usuário pede uma explicação ou tutorial
- O usuário está conversando normalmente

### FERRAMENTAS DISPONÍVEIS

{tool_list}

</tools_disponiveis>"""
        return block
