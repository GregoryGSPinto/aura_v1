from typing import Dict, List

from app.aura_os.config.models import ToolDescriptor


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolDescriptor] = {}

    def register(self, descriptor: ToolDescriptor) -> None:
        self._tools[descriptor.name] = descriptor

    def register_defaults(self) -> None:
        defaults = [
            ToolDescriptor(
                name="system_tool",
                category="system",
                description="Telemetria local do computador, backend e runtime.",
                capabilities=["cpu", "memory", "disk", "processes", "health"],
            ),
            ToolDescriptor(
                name="browser_tool",
                category="browser",
                description="Abre navegador, localhost e URLs seguras no Mac.",
                capabilities=["open_url", "open_localhost"],
            ),
            ToolDescriptor(
                name="filesystem_tool",
                category="files",
                description="Leitura segura de arquivos e navegação em roots autorizadas.",
                capabilities=["list", "read", "find", "grep"],
            ),
            ToolDescriptor(
                name="project_tool",
                category="developer",
                description="Lista, inspeciona, abre projetos e sugere comandos úteis.",
                capabilities=["list_projects", "open_project", "inspect_project", "run_script"],
            ),
            ToolDescriptor(
                name="terminal_tool",
                category="developer",
                description="Executa receitas seguras de terminal sem shell arbitrário.",
                capabilities=["git_status", "pnpm_lint", "pnpm_build", "pnpm_test", "pnpm_dev"],
            ),
            ToolDescriptor(
                name="vscode_tool",
                category="developer",
                description="Abre VS Code, workspaces e arquivos específicos.",
                capabilities=["open_app", "open_path", "open_file"],
            ),
            ToolDescriptor(
                name="llm_tool",
                category="ai",
                description="Usa o modelo local via Ollama para raciocínio, resumo e análise.",
                capabilities=["chat", "summarize", "analyze_repo", "generate_plan"],
            ),
            ToolDescriptor(
                name="research_tool",
                category="internet",
                description="Busca na web, processa páginas e retorna um resumo estruturado.",
                capabilities=["search", "scrape", "summarize", "research"],
            ),
        ]
        for descriptor in defaults:
            self.register(descriptor)

    def list_tools(self) -> List[ToolDescriptor]:
        return list(self._tools.values())
