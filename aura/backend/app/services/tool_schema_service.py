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
                "description": "Envia um prompt para o Claude Code e retorna o resultado. Usa para tarefas complexas de código, análise, commits, deploys.",
                "parameters": {
                    "prompt": {"type": "string", "description": "Prompt a enviar para o Claude Code", "required": True},
                    "working_dir": {"type": "string", "description": "Diretório de trabalho (default: aura_v1)", "required": False},
                },
                "risk_level": "elevated",
                "requires_confirmation": True,
                "examples": ["Analisa o código do backend e sugere melhorias", "Faz commit das mudanças com mensagem descritiva"],
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
        ]
        return [t for t in tools if self._is_allowed(t["name"])]

    def _is_allowed(self, tool_name: str) -> bool:
        return True  # All tools allowed; security handled at execution

    def get_tools_prompt_block(self) -> str:
        tools = self.get_available_tools()
        block = "<tools_disponiveis>\nFERRAMENTAS QUE VOCÊ PODE USAR:\n\n"
        block += "Quando quiser executar uma ação, responda com um bloco JSON:\n"
        block += '```tool_call\n{"tool": "nome.da.tool", "params": {...}, "reason": "por quê"}\n```\n\n'
        block += "Tools com requires_confirmation=true precisam de aprovação antes de executar.\n\n"
        block += "FERRAMENTAS DISPONÍVEIS:\n"
        for tool in tools:
            params_desc = ""
            if tool.get("parameters") and isinstance(tool["parameters"], dict):
                params_list = [
                    f"  - {k}: {v.get('description', '')} ({'obrigatório' if v.get('required') else 'opcional'})"
                    for k, v in tool["parameters"].items()
                    if isinstance(v, dict)
                ]
                params_desc = "\n".join(params_list)
            confirm = " ⚠️ REQUER CONFIRMAÇÃO" if tool.get("requires_confirmation") else ""
            risk = tool.get("risk_level", "low")
            block += f"\n### {tool['name']} [{risk}]{confirm}\n"
            block += f"{tool['description']}\n"
            if params_desc:
                block += f"Parâmetros:\n{params_desc}\n"
            if tool.get("examples"):
                block += f"Exemplos: {', '.join(tool['examples'])}\n"
        block += "\n</tools_disponiveis>"
        return block
