"""
DevTool — Adaptador que integra o AuraDev no sistema de tools da Aura.

Detecta intenção de desenvolvimento em mensagens naturais e roteia
para o endpoint correto do AuraDev.
"""
from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

from app.tools.aura_dev import (
    DevResult,
    Provider,
    add_feature,
    code_review,
    dev,
    fix_error,
    generate_tests,
    get_project_tree,
    read_file,
    run_command,
)

logger = logging.getLogger("aura")

WORKSPACE = os.path.expanduser("~/Projetos")

# ══════════════════════════════════════════════════════════════
# DETECÇÃO DE INTENÇÃO DE DESENVOLVIMENTO
# ══════════════════════════════════════════════════════════════

# Ordered by specificity — more specific intents checked FIRST to avoid
# generic "task" swallowing review/fix/tests.
DEV_INTENT_PATTERNS: List[tuple] = [
    ("review", [
        r"\b(review|revis[ãa]o|analise?a?|avali[ae])\b.*\b(c[óo]digo|code|arquivo|file)\b",
        r"\bcode\s*review\b",
        r"\b(review|revis[ãa]o)\b.*\.(py|ts|tsx|js|jsx)\b",
    ]),
    ("fix", [
        r"\b(corrig[ea]|fix|consert[ae]|resolv[ae]|debug)\b.*\b(erro|error|bug|crash|quebr|fail|falh|issue|problema)\b",
        r"\b(erro|error|bug|crash)\b.*\b(corrig|fix|resolv|consert)\b",
        r"traceback|exception|stacktrace|TypeError|ValueError|KeyError|ImportError|SyntaxError",
    ]),
    ("tests", [
        r"\b(gere?a?r?|cri[ae]|escreve?r?|write|add)\b.*\b(test[es]?|testes?)\b",
        r"\b(test[ae]?s?\s+(unit|unitário|integra))\b",
        r"\b(cobertura|coverage)\b.*\b(test|código|code)\b",
    ]),
    ("feature", [
        r"\b(adiciona?r?|add)\b.*\b(feature|recurso|funcionalidade)\b",
        r"\b(nova feature|novo recurso|nova funcionalidade)\b",
    ]),
    ("tree", [
        r"\b(estrutura|structure|tree|[áa]rvore)\b.*\b(projeto|project|diret[óo]rio|directory|pasta|folder)\b",
        r"\bmostr[ae]\b.*\b(arquivos|files|estrutura)\b.*\b(projeto|project)\b",
    ]),
    ("run", [
        r"\b(rod[ae]|exec|run|execute)\b.*\b(comando|command|script|npm|pip|python|node|pnpm|yarn)\b",
        r"\b(instale?a?r?|install)\b.*\b(pacote|package|depend[eê]ncia|dependency|lib)\b",
    ]),
    ("task", [
        # Criação de código
        r"\b(cri[ae]|crie|gere?a?r?|fa[çz]a?|build|make|write|implement|code)\b.*\b(fun[çc][ãa]o|classe?|componente?|script|api|endpoint|rota|module|hook|service|util|helper)\b",
        r"\b(programa|desenvolv[ae]|cod(?:ifique|e))\b",
        # Refatoração
        r"\b(refator[ae]|refactor|reescrev[ae]|rewrite)\b",
        # Boilerplate/scaffold
        r"\b(scaffold|boilerplate|template|starter)\b",
    ]),
]

# Patterns that indicate this is a conversation/question, NOT a dev request
CONVERSATION_OVERRIDE_PATTERNS = [
    r"^(como faço|como eu|como fazer|como posso|me ensina|me explica|o que [eé]|qual [eé])",
    r"\b(tutorial|dica|explica|ajuda a entender|significa)\b",
    r"(no iphone|no android|no celular|no mac|no windows|no chrome|no safari)",
]

# File extension patterns
FILE_PATTERN = re.compile(
    r"(?:arquivo |file |do |o |de )?"
    r"([\w./\\-]+\.(?:py|ts|tsx|js|jsx|json|md|yaml|yml|toml|css|html|vue|svelte|go|rs|java|rb|php|sh|sql))",
    re.IGNORECASE,
)

# Project name patterns
PROJECT_PATTERN = re.compile(
    r"(?:projeto |project |do |no |from |in |pro )(\w[\w_-]*)",
    re.IGNORECASE,
)

# Provider override patterns
PROVIDER_PATTERNS = {
    "claude": re.compile(r"\b(usa?r?\s+(?:o\s+)?claude|com\s+claude|via\s+claude)\b", re.IGNORECASE),
    "qwen": re.compile(r"\b(usa?r?\s+(?:o\s+)?qwen|com\s+qwen|via\s+qwen|via\s+ollama)\b", re.IGNORECASE),
}

# Traceback pattern
TRACEBACK_PATTERN = re.compile(
    r"(Traceback \(most recent call last\)[\s\S]+?\w+Error:.+|"
    r"Error:.*at line \d+|"
    r"(?:File \".+\", line \d+))",
    re.MULTILINE,
)


def detect_dev_intent(message: str) -> Optional[Dict[str, Any]]:
    """
    Detect dev intent from a natural language message.

    Returns dict with intent_type, params, or None if not a dev message.
    """
    msg_lower = message.lower().strip()

    # Skip if it looks like a conversation/question
    for pattern in CONVERSATION_OVERRIDE_PATTERNS:
        if re.search(pattern, msg_lower):
            return None

    # Check each intent type (ordered by specificity)
    matched_intent = None
    for intent_type, patterns in DEV_INTENT_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                matched_intent = intent_type
                break
        if matched_intent:
            break

    if not matched_intent:
        return None

    # Extract parameters
    params: Dict[str, Any] = {"task": message}

    # Extract file path
    file_match = FILE_PATTERN.search(message)
    if file_match:
        params["file"] = file_match.group(1)

    # Extract project name
    proj_match = PROJECT_PATTERN.search(message)
    if proj_match:
        candidate = proj_match.group(1)
        # Verify it's a real project dir
        if os.path.isdir(os.path.join(WORKSPACE, candidate)):
            params["project"] = candidate

    # Extract provider override
    for provider_name, pattern in PROVIDER_PATTERNS.items():
        if pattern.search(message):
            params["provider"] = provider_name
            break

    # Extract traceback for fix intent
    if matched_intent == "fix":
        tb_match = TRACEBACK_PATTERN.search(message)
        if tb_match:
            params["traceback"] = tb_match.group(0)

    return {
        "intent_type": matched_intent,
        "params": params,
    }


def format_dev_result(result: DevResult) -> str:
    """Format AuraDev result for display in chat."""
    if not result.success:
        return f"AuraDev | Erro\n\n{result.error or 'Erro desconhecido'}"

    header = f"AuraDev | {result.provider.capitalize()} ({result.execution_time:.1f}s)"

    parts = [header, ""]

    # Format output
    output = result.output.strip()
    if output:
        parts.append(output)

    # Files changed
    if result.files_changed:
        parts.append("")
        files_list = ", ".join(result.files_changed)
        parts.append(f"Arquivos modificados: {files_list}")

    return "\n".join(parts)


class DevTool:
    """
    Wrapper that exposes AuraDev functions as a tool for ToolRegistryV2.

    Methods follow the ToolRegistryV2 pattern: tool_name.method_name
    """

    async def task(self, task: str, project: str = None, provider: str = None,
                   context_patterns: list = None, write_output: bool = False) -> dict:
        """Execute a generic dev task."""
        result = await dev(
            task=task,
            provider=provider,
            project=project,
            context_patterns=context_patterns,
            write_output=write_output,
        )
        return {
            "status": "success" if result.success else "error",
            "output": format_dev_result(result),
            "raw": result.to_dict(),
        }

    async def fix(self, error_message: str, file_path: str, project: str = None) -> dict:
        """Fix an error from traceback."""
        result = await fix_error(error_message, file_path, project)
        return {
            "status": "success" if result.success else "error",
            "output": format_dev_result(result),
            "raw": result.to_dict(),
        }

    async def review(self, file_path: str, project: str = None) -> dict:
        """Deep code review (always Claude)."""
        result = await code_review(file_path, project)
        return {
            "status": "success" if result.success else "error",
            "output": format_dev_result(result),
            "raw": result.to_dict(),
        }

    async def tests(self, file_path: str, project: str = None) -> dict:
        """Generate tests for a file."""
        result = await generate_tests(file_path, project)
        return {
            "status": "success" if result.success else "error",
            "output": format_dev_result(result),
            "raw": result.to_dict(),
        }

    async def feature(self, description: str, project: str, files: list = None) -> dict:
        """Add a feature to a project."""
        result = await add_feature(description, project, files)
        return {
            "status": "success" if result.success else "error",
            "output": format_dev_result(result),
            "raw": result.to_dict(),
        }

    def tree(self, project: str, depth: int = 3) -> dict:
        """Return project file tree."""
        project_path = os.path.join(WORKSPACE, project)
        if not os.path.isdir(project_path):
            return {"status": "error", "output": f"Projeto não encontrado: {project}"}
        tree = get_project_tree(project_path, depth)
        return {"status": "success", "output": tree}

    def read(self, path: str) -> dict:
        """Read a file."""
        content = read_file(path)
        return {"status": "success", "output": content}

    def run(self, command: str, cwd: str = None) -> dict:
        """Execute a command (with safety check)."""
        return run_command(command, cwd)

    async def execute_from_intent(self, intent_type: str, params: Dict[str, Any]) -> str:
        """
        Execute AuraDev based on detected intent. Called from chat.py.

        Returns formatted response string for the chat.
        """
        task = params.get("task", "")
        project = params.get("project")
        file_path = params.get("file")
        provider = params.get("provider")

        try:
            if intent_type == "fix":
                traceback_text = params.get("traceback", task)
                if file_path:
                    result = await fix_error(traceback_text, file_path, project)
                else:
                    result = await dev(task=task, provider=provider, project=project)

            elif intent_type == "review":
                if file_path:
                    result = await code_review(file_path, project)
                else:
                    result = await dev(task=task, provider=Provider.CLAUDE, project=project)

            elif intent_type == "tests":
                if file_path:
                    result = await generate_tests(file_path, project)
                else:
                    result = await dev(task=task, provider=provider, project=project)

            elif intent_type == "feature":
                if project:
                    files = [file_path] if file_path else None
                    result = await add_feature(task, project, files)
                else:
                    result = await dev(task=task, provider=provider, project=project)

            elif intent_type == "tree":
                if project:
                    tree = get_project_tree(os.path.join(WORKSPACE, project))
                    return f"AuraDev | Estrutura do projeto {project}\n\n```\n{tree}\n```"
                return "AuraDev | Erro\n\nEspecifique o projeto. Ex: 'mostra a estrutura do projeto aura_v1'"

            elif intent_type == "run":
                cmd_result = run_command(task, params.get("cwd"))
                status = cmd_result.get("status", "error")
                if status == "blocked":
                    return f"AuraDev | Bloqueado (L3)\n\n{cmd_result.get('error', '')}"
                output = cmd_result.get("stdout", "") or cmd_result.get("error", "")
                return f"AuraDev | Comando executado\n\n```\n{output}\n```"

            else:
                # Generic task
                result = await dev(task=task, provider=provider, project=project)

            return format_dev_result(result)

        except Exception as e:
            logger.error("[DevTool] execute_from_intent failed: %s", e)
            return f"AuraDev | Erro\n\n{str(e)}"
