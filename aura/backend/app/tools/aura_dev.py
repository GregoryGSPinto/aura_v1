"""
AuraDev — Motor de desenvolvimento autônomo da Aura.

Dois modos:
- QWEN: Ollama local, tarefas simples, Aura gerencia I/O de arquivos
- CLAUDE: Claude Code CLI (subprocess), tarefas complexas, agentic (ele mesmo lê/escreve)

Níveis de autonomia:
- L1 (autônomo): consultar LLMs, ler arquivos, analisar código
- L2 (aprovação): escrever/modificar arquivos, executar comandos
- L3 (bloqueado): deploy, git push, deletar diretórios, operações irreversíveis
"""
from __future__ import annotations

import asyncio
import subprocess
import json
import os
import re
import time
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

import httpx


# ══════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════════

OLLAMA_URL = "http://localhost:11434/api/chat"
QWEN_MODEL = "qwen3:latest"
WORKSPACE = os.path.expanduser("~/Projetos")
BLOCKED_COMMANDS = [
    "rm -rf /", "rm -rf ~", "rm -rf /*",
    "git push", "git push --force",
    "docker rm", "docker rmi",
    "drop database", "drop table",
    "shutdown", "reboot",
    "npm publish", "pip upload",
]


class Provider(str, Enum):
    QWEN = "qwen"
    CLAUDE = "claude"


class AutonomyLevel(str, Enum):
    L1_AUTONOMOUS = "L1"   # Consulta, leitura — sem efeito colateral
    L2_APPROVAL = "L2"     # Escrita, execução — requer aprovação
    L3_BLOCKED = "L3"      # Irreversível — sempre bloqueado


@dataclass
class DevResult:
    provider: str
    task: str
    output: str
    files_changed: list = field(default_factory=list)
    autonomy_level: str = "L1"
    execution_time: float = 0.0
    success: bool = True
    error: Optional[str] = None

    def to_dict(self):
        return {
            "provider": self.provider,
            "task": self.task,
            "output": self.output,
            "files_changed": self.files_changed,
            "autonomy_level": self.autonomy_level,
            "execution_time": round(self.execution_time, 2),
            "success": self.success,
            "error": self.error,
        }


# ══════════════════════════════════════════════════════════════
# CLASSIFICADOR DE COMPLEXIDADE
# ══════════════════════════════════════════════════════════════

COMPLEX_PATTERNS = [
    # Arquitetura e design
    r"\b(architect|design system|redesign|migration|refactor entire)\b",
    r"\b(arquitetura|redesenhar|migra[çc][ãa]o|refatorar tudo)\b",
    # Multi-arquivo
    r"\b(across files|multiple files|multi.?file|full.?stack)\b",
    r"\b(v[áa]rios arquivos|m[úu]ltiplos arquivos|projeto inteiro)\b",
    # Debugging complexo
    r"\b(debug complex|memory leak|race condition|deadlock)\b",
    r"\b(bug cr[íi]tico|vazamento|condi[çc][ãa]o de corrida)\b",
    # Segurança
    r"\b(security audit|vulnerability|auth flow|encryption)\b",
    r"\b(auditoria|vulnerabilidade|fluxo de auth|criptografia)\b",
    # Review e análise profunda
    r"\b(code review|performance|otimiz|optimi[sz])\b",
    r"\b(review completo|an[áa]lise profunda)\b",
    # Integração
    r"\b(integra[çc][ãa]o|integration|api design|webhook)\b",
    # Explicitamente complexo
    r"\b(complex|dif[íi]cil|avan[çc]ado|advanced)\b",
]

SIMPLE_PATTERNS = [
    r"\b(function|fun[çc][ãa]o|método|method|helper|util)\b",
    r"\b(fix typo|corrigir|ajustar|formatar|format)\b",
    r"\b(test unit|teste unit[áa]rio|add test)\b",
    r"\b(boilerplate|template|scaffold|gerar)\b",
    r"\b(rename|renomear|mover|move)\b",
    r"\b(tipo|type|interface|model|schema)\b",
    r"\b(simple|simples|r[áa]pido|quick)\b",
    r"\b(css|style|estilo|color|cor|margin|padding)\b",
    r"\b(readme|docstring|comment|coment[áa]rio|documenta)\b",
]


def classify_task(task: str) -> Provider:
    """Classifica automaticamente a complexidade da tarefa."""
    task_lower = task.lower()

    complex_score = sum(1 for p in COMPLEX_PATTERNS if re.search(p, task_lower))
    simple_score = sum(1 for p in SIMPLE_PATTERNS if re.search(p, task_lower))

    # Se tem mais sinais de complexidade, ou se é ambíguo com texto longo
    if complex_score > simple_score:
        return Provider.CLAUDE
    if complex_score == simple_score and len(task) > 500:
        return Provider.CLAUDE

    return Provider.QWEN


def classify_autonomy(action: str) -> AutonomyLevel:
    """Classifica o nível de autonomia de uma ação."""
    action_lower = action.lower()

    # L3 — Bloqueado
    for blocked in BLOCKED_COMMANDS:
        if blocked in action_lower:
            return AutonomyLevel.L3_BLOCKED

    # L2 — Requer aprovação
    write_patterns = [
        r"\bwrite\b", r"\bcreate\b", r"\bdelete\b", r"\bremove\b",
        r"\bmodify\b", r"\bedit\b", r"\binstall\b", r"\bexec\b",
        r"\bescrever\b", r"\bcriar\b", r"\bdeletar\b", r"\bremover\b",
        r"\bmodificar\b", r"\beditar\b", r"\binstalar\b", r"\bexecutar\b",
    ]
    if any(re.search(p, action_lower) for p in write_patterns):
        return AutonomyLevel.L2_APPROVAL

    # L1 — Autônomo
    return AutonomyLevel.L1_AUTONOMOUS


# ══════════════════════════════════════════════════════════════
# MOTOR QWEN (Local via Ollama)
# ══════════════════════════════════════════════════════════════

QWEN_SYSTEM_PROMPT = """You are a senior software engineer working inside Aura's development system.

RULES:
- Return ONLY code unless explicitly asked for explanation
- Use best practices, error handling, and type hints (Python) or TypeScript types
- Follow the existing project conventions shown in context
- If writing Python: use async/await, dataclasses, pathlib
- If writing TypeScript/React: use functional components, hooks, Tailwind
- Be concise — no filler comments like "// This function does X"
- Output the complete file content when creating/editing files
- Wrap code in ```language blocks with the target filepath as first comment
"""


async def ask_qwen(
    prompt: str,
    system: str = QWEN_SYSTEM_PROMPT,
    context_files: dict[str, str] | None = None,
) -> str:
    """Consulta Qwen local via Ollama. L1 — autônomo."""

    # Monta contexto com arquivos relevantes
    file_context = ""
    if context_files:
        for path, content in context_files.items():
            file_context += f"\n### FILE: {path}\n```\n{content}\n```\n"

    full_prompt = prompt
    if file_context:
        full_prompt = f"EXISTING CODE:\n{file_context}\n\nTASK:\n{prompt}"

    async with httpx.AsyncClient(timeout=180) as client:
        try:
            resp = await client.post(OLLAMA_URL, json={
                "model": QWEN_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": full_prompt},
                ],
                "stream": False,
                "options": {"temperature": 0.3},
                "think": False,
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except httpx.TimeoutException:
            return "ERROR: Qwen timeout (180s). Tente dividir a tarefa."
        except Exception as e:
            return f"ERROR: Qwen falhou — {str(e)}"


# ══════════════════════════════════════════════════════════════
# MOTOR CLAUDE CODE (CLI — Agentic)
# ══════════════════════════════════════════════════════════════

async def ask_claude_code(
    prompt: str,
    project_path: str | None = None,
) -> str:
    """
    Delega tarefa complexa ao Claude Code CLI.
    Claude Code é agentic — ele mesmo lê, escreve e executa.
    L2 — aprovação implícita (Gregory já aprovou a tarefa).
    """
    cwd = project_path or WORKSPACE

    # Monta o prompt com contexto do projeto
    full_prompt = f"""Você está trabalhando no diretório: {cwd}

TAREFA:
{prompt}

REGRAS:
- Leia os arquivos necessários antes de modificar
- Mantenha as convenções existentes do projeto
- Adicione tratamento de erros
- Não faça git push ou deploy
- Reporte exatamente o que foi alterado
"""

    try:
        # Executa Claude Code como subprocess assíncrono
        process = await asyncio.create_subprocess_exec(
            "claude", "-p", full_prompt, "--no-input",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=300,  # 5 min max para tarefas complexas
        )

        output = stdout.decode("utf-8", errors="replace")
        if process.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="replace")
            return f"ERROR: Claude Code retornou código {process.returncode}\n{error_msg}\n{output}"

        return output

    except asyncio.TimeoutError:
        return "ERROR: Claude Code timeout (5min). Tarefa muito grande — divida em partes."
    except FileNotFoundError:
        return "ERROR: Claude Code CLI não encontrado. Instale: npm install -g @anthropic-ai/claude-code"
    except Exception as e:
        return f"ERROR: Claude Code falhou — {str(e)}"


# ══════════════════════════════════════════════════════════════
# UTILIDADES DE PROJETO
# ══════════════════════════════════════════════════════════════

def read_file(path: str) -> str:
    """Lê um arquivo. L1 — autônomo."""
    try:
        return Path(path).read_text(encoding="utf-8")
    except Exception as e:
        return f"ERROR: Não foi possível ler {path} — {e}"


def write_file(path: str, content: str) -> dict:
    """Escreve um arquivo. L2 — requer aprovação."""
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(p), "size": len(content)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_project_tree(project_path: str, max_depth: int = 3) -> str:
    """Retorna a estrutura do projeto. L1 — autônomo."""
    try:
        result = subprocess.run(
            [
                "find", project_path,
                "-maxdepth", str(max_depth),
                "-not", "-path", "*/node_modules/*",
                "-not", "-path", "*/.git/*",
                "-not", "-path", "*/__pycache__/*",
                "-not", "-path", "*/.next/*",
                "-not", "-path", "*/venv/*",
                "-not", "-name", "*.pyc",
            ],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout[:5000]
    except Exception as e:
        return f"ERROR: {e}"


def run_command(cmd: str, cwd: str | None = None) -> dict:
    """Executa comando no terminal. L2 — requer aprovação."""
    # Verifica se é L3 (bloqueado)
    level = classify_autonomy(cmd)
    if level == AutonomyLevel.L3_BLOCKED:
        return {
            "status": "blocked",
            "error": f"Comando bloqueado (L3): {cmd}",
            "autonomy": "L3",
        }

    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True,
            text=True, timeout=120, cwd=cwd,
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "stdout": result.stdout[-3000:],
            "stderr": result.stderr[-1000:],
            "returncode": result.returncode,
            "autonomy": "L2",
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "Timeout (120s)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def read_context_files(project_path: str, patterns: list[str]) -> dict[str, str]:
    """Lê múltiplos arquivos para contexto. L1."""
    files = {}
    project = Path(project_path)
    for pattern in patterns:
        for match in project.rglob(pattern):
            if any(skip in str(match) for skip in [
                "node_modules", ".git", "__pycache__", ".next", "venv"
            ]):
                continue
            try:
                content = match.read_text(encoding="utf-8")
                if len(content) < 10000:
                    rel_path = str(match.relative_to(project))
                    files[rel_path] = content
            except Exception:
                continue
    return files


# ══════════════════════════════════════════════════════════════
# ORQUESTRADOR PRINCIPAL
# ══════════════════════════════════════════════════════════════

async def dev(
    task: str,
    provider: Provider | str | None = None,
    project: str | None = None,
    context_patterns: list[str] | None = None,
    write_output: bool = False,
) -> DevResult:
    """
    Ponto de entrada principal do AuraDev.

    Args:
        task: Descrição da tarefa de desenvolvimento
        provider: "qwen" | "claude" | None (auto-detect)
        project: Nome do projeto em ~/Projetos (ex: "aura_v1")
        context_patterns: Globs para ler arquivos de contexto (ex: ["*.py", "*.ts"])
        write_output: Se True, extrai e escreve arquivos do output (L2)

    Returns:
        DevResult com o output e metadados
    """
    start = time.time()

    # Resolve provider
    if provider is None:
        provider = classify_task(task)
    elif isinstance(provider, str):
        provider = Provider(provider)

    # Resolve projeto
    project_path = None
    if project:
        project_path = os.path.join(WORKSPACE, project)
        if not os.path.exists(project_path):
            return DevResult(
                provider=provider.value, task=task,
                output="", success=False,
                error=f"Projeto não encontrado: {project_path}",
            )

    # Executa
    try:
        if provider == Provider.CLAUDE:
            output = await ask_claude_code(task, project_path)
            result = DevResult(
                provider="claude", task=task, output=output,
                autonomy_level="L2",
                execution_time=time.time() - start,
            )
        else:
            # Para Qwen, carrega contexto de arquivos
            context_files = None
            if project_path and context_patterns:
                context_files = read_context_files(project_path, context_patterns)

            output = await ask_qwen(task, context_files=context_files)
            result = DevResult(
                provider="qwen", task=task, output=output,
                autonomy_level="L1",
                execution_time=time.time() - start,
            )

        # Se solicitado, extrai e escreve arquivos do output
        if write_output and project_path and result.success:
            written = extract_and_write_files(result.output, project_path)
            result.files_changed = written
            result.autonomy_level = "L2"

    except Exception as e:
        result = DevResult(
            provider=provider.value, task=task,
            output="", success=False,
            error=str(e),
            execution_time=time.time() - start,
        )

    return result


def extract_and_write_files(output: str, base_path: str) -> list[str]:
    """
    Extrai blocos de código do output e escreve nos arquivos indicados.
    Procura padrões como:
      ```python
      # filepath: backend/tools/example.py
      ...
      ```
    L2 — requer aprovação.
    """
    written = []
    # Padrão: ```lang\n# filepath: caminho\n...```
    pattern = r"```\w*\n#\s*(?:filepath|file|path):\s*(.+?)\n(.*?)```"
    matches = re.findall(pattern, output, re.DOTALL | re.IGNORECASE)

    for filepath, content in matches:
        filepath = filepath.strip()
        # Resolve caminho relativo ao projeto
        if not os.path.isabs(filepath):
            filepath = os.path.join(base_path, filepath)
        result = write_file(filepath, content.strip() + "\n")
        if result["status"] == "ok":
            written.append(filepath)

    return written


# ══════════════════════════════════════════════════════════════
# AÇÕES COMPOSTAS — Workflows pré-definidos
# ══════════════════════════════════════════════════════════════

async def fix_error(
    error_message: str,
    file_path: str,
    project: str | None = None,
) -> DevResult:
    """Corrige um erro dado o traceback e arquivo. Auto-classifica."""
    code = read_file(file_path)
    task = f"""Fix this error:

ERROR:
{error_message}

FILE ({file_path}):
```
{code}
```

Return the corrected complete file content.
"""
    return await dev(task, project=project)


async def add_feature(
    description: str,
    project: str,
    files: list[str] | None = None,
) -> DevResult:
    """Adiciona uma feature. Lê arquivos relevantes para contexto."""
    project_path = os.path.join(WORKSPACE, project)

    # Lê arquivos específicos se fornecidos
    context = ""
    if files:
        for f in files:
            full_path = os.path.join(project_path, f)
            content = read_file(full_path)
            context += f"\n### {f}\n```\n{content}\n```\n"

    task = f"""Add this feature to the project at {project_path}:

{description}

{"EXISTING FILES:" + context if context else "Read the relevant files first."}

RULES:
- Integrate with existing code style and patterns
- Add proper error handling
- Include type annotations
- Mark each output file with # filepath: relative/path
"""
    return await dev(task, project=project)


async def code_review(
    file_path: str,
    project: str | None = None,
) -> DevResult:
    """Code review profundo — sempre usa Claude. L1."""
    code = read_file(file_path)
    task = f"""Do a thorough code review of this file:

FILE: {file_path}
```
{code}
```

Analyze:
1. Bugs and potential issues
2. Security vulnerabilities
3. Performance problems
4. Code quality and readability
5. Missing error handling
6. Suggestions for improvement

Be specific — reference line numbers and suggest concrete fixes.
"""
    return await dev(task, provider=Provider.CLAUDE, project=project)


async def generate_tests(
    file_path: str,
    project: str | None = None,
) -> DevResult:
    """Gera testes para um arquivo. Qwen para simples, Claude para complexo."""
    code = read_file(file_path)
    task = f"""Generate comprehensive tests for this file:

FILE: {file_path}
```
{code}
```

RULES:
- Use pytest (Python) or Jest/Vitest (TypeScript)
- Cover happy path, edge cases, and error cases
- Use descriptive test names in Portuguese
- Mock external dependencies
- Mark output with # filepath: tests/test_<original_name>
"""
    return await dev(task, project=project)
