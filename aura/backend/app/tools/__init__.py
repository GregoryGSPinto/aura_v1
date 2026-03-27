from app.tools.base import RiskLevel, ToolResult, ToolStatus
from app.tools.browser_tool import BrowserTool
from app.tools.claude_tool import ClaudeTool
from app.tools.doc_tool import DocTool
from app.tools.filesystem_tool import FilesystemTool
from app.tools.git_tool import GitTool
from app.tools.llm_tool import LLMTool
from app.tools.project_tool import ProjectTool
from app.tools.system_tool import SystemTool
from app.tools.terminal_tool import TerminalTool, TerminalResult
from app.tools.tool_registry_v2 import ToolRegistryV2
from app.tools.tool_router import ToolRouter, ToolRoute
from app.tools.vscode_tool import VSCodeTool
from app.tools.aura_dev import dev as aura_dev, DevResult, Provider as DevProvider
from app.tools.dev_tool import DevTool

# Agent Tool Layer (Mega Prompt)
from app.tools.tool_registry import ToolRegistry as AgentToolRegistry
from app.tools.shell_tool import ShellTool
from app.tools.file_tool import FileReadTool, FileWriteTool, FileSearchTool, FileListTool
from app.tools.git_agent_tool import GitAgentTool
from app.tools.claude_code_tool import ClaudeCodeTool
from app.tools.browser_agent_tool import BrowserAgentTool
from app.tools.vercel_tool import VercelTool
from app.tools.macos_tool import MacOSTool
from app.tools.browser_navigator import BrowserNavigator
from app.tools.web_workflows import WebWorkflowTool
from app.tools.attachment_tool import AttachmentTool


def create_tool_registry() -> AgentToolRegistry:
    """Cria e registra todas as tools da Aura para o Agent Service."""
    registry = AgentToolRegistry()

    # Sistema
    registry.register(ShellTool())
    registry.register(MacOSTool())

    # Filesystem
    registry.register(FileReadTool())
    registry.register(FileWriteTool())
    registry.register(FileSearchTool())
    registry.register(FileListTool())

    # Git
    registry.register(GitAgentTool())

    # Desenvolvimento
    registry.register(ClaudeCodeTool())

    # Deploy
    registry.register(VercelTool())

    # Browser
    registry.register(BrowserAgentTool())
    registry.register(BrowserNavigator())
    registry.register(WebWorkflowTool())

    # Attachments
    registry.register(AttachmentTool())

    return registry


__all__ = [
    "BrowserTool",
    "ClaudeTool",
    "DevProvider",
    "DevResult",
    "DevTool",
    "DocTool",
    "FilesystemTool",
    "GitTool",
    "LLMTool",
    "ProjectTool",
    "RiskLevel",
    "SystemTool",
    "TerminalTool",
    "TerminalResult",
    "ToolRegistryV2",
    "ToolResult",
    "ToolRouter",
    "ToolRoute",
    "ToolStatus",
    "VSCodeTool",
    "aura_dev",
    "AgentToolRegistry",
    "ShellTool",
    "FileReadTool",
    "FileWriteTool",
    "FileSearchTool",
    "FileListTool",
    "GitAgentTool",
    "ClaudeCodeTool",
    "BrowserAgentTool",
    "VercelTool",
    "MacOSTool",
    "BrowserNavigator",
    "WebWorkflowTool",
    "AttachmentTool",
    "create_tool_registry",
]
