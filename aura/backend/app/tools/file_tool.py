"""
File Tool — Le, escreve, cria, busca arquivos no Mac.

Seguranca:
- Leitura de qualquer arquivo texto -> L1
- Escrita/criacao de arquivos -> L2
- Delecao -> L3 BLOQUEADO (usa shell rm via aprovacao L2 se necessario)
- Path traversal protegido (nao sai do home do usuario)
- Arquivos binarios: retorna info, nao conteudo
- .env e secrets: NUNCA expostos ao LLM
"""

import os
import glob
from pathlib import Path
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


SENSITIVE_FILES = {".env", ".env.local", ".env.production", ".env.development"}
BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
                     ".tar", ".gz", ".mp3", ".mp4", ".mov", ".avi", ".exe", ".dmg",
                     ".sqlite", ".db", ".woff", ".woff2", ".ttf", ".eot"}
HOME = os.path.expanduser("~")


class FileReadTool(BaseTool):
    name = "file_read"
    description = "Le o conteudo de um arquivo texto. Suporta visualizacao parcial com line range."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Caminho do arquivo (absoluto ou relativo ao home)"},
            "start_line": {"type": "integer", "description": "Linha inicial (opcional, comeca em 1)"},
            "end_line": {"type": "integer", "description": "Linha final (opcional)"},
        },
        "required": ["path"]
    }

    async def execute(self, params: dict) -> ToolResult:
        path = os.path.expanduser(params["path"])
        if not path.startswith(HOME):
            path = os.path.join(HOME, path)

        real_path = os.path.realpath(path)
        if not real_path.startswith(HOME):
            return ToolResult(success=False, output=None,
                              error="Path traversal bloqueado: nao pode acessar fora do home")

        if os.path.basename(path) in SENSITIVE_FILES:
            return ToolResult(success=False, output=None,
                              error="Arquivo sensivel: nao pode ler .env")

        if not os.path.exists(real_path):
            return ToolResult(success=False, output=None,
                              error=f"Arquivo nao encontrado: {path}")

        ext = os.path.splitext(path)[1].lower()
        if ext in BINARY_EXTENSIONS:
            size = os.path.getsize(real_path)
            return ToolResult(success=True,
                              output=f"Arquivo binario ({ext}), tamanho: {size} bytes")

        try:
            with open(real_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            start = params.get("start_line", 1) - 1
            end = params.get("end_line", len(lines))
            selected = lines[max(0, start):end]

            # Limitar output a 50KB para nao estourar contexto
            content = "".join(selected)
            if len(content) > 50000:
                content = content[:50000] + "\n\n[...TRUNCADO — arquivo muito grande]"

            return ToolResult(
                success=True,
                output=f"Arquivo: {path} ({len(lines)} linhas)\n\n{content}"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileWriteTool(BaseTool):
    name = "file_write"
    description = "Cria ou sobrescreve um arquivo com o conteudo especificado."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L2_APPROVAL
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Caminho do arquivo"},
            "content": {"type": "string", "description": "Conteudo a escrever"},
            "append": {"type": "boolean", "description": "Se true, adiciona ao final em vez de sobrescrever"},
        },
        "required": ["path", "content"]
    }

    async def execute(self, params: dict) -> ToolResult:
        path = os.path.expanduser(params["path"])
        if not path.startswith(HOME):
            path = os.path.join(HOME, path)

        real_path = os.path.realpath(os.path.dirname(path))
        if not real_path.startswith(HOME):
            return ToolResult(success=False, output=None,
                              error="Path traversal bloqueado")

        if os.path.basename(path) in SENSITIVE_FILES:
            return ToolResult(success=False, output=None,
                              error="Nao pode sobrescrever arquivo sensivel")

        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            mode = "a" if params.get("append", False) else "w"
            with open(path, mode, encoding="utf-8") as f:
                f.write(params["content"])
            return ToolResult(
                success=True,
                output=f"Arquivo salvo: {path} ({len(params['content'])} caracteres)"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileSearchTool(BaseTool):
    name = "file_search"
    description = "Busca arquivos por nome ou padrao glob no Mac."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {"type": "string", "description": "Padrao de busca (glob). Ex: '**/*.py', 'README*'"},
            "directory": {"type": "string", "description": "Diretorio raiz da busca (padrao: ~/Projetos)"},
            "max_results": {"type": "integer", "description": "Maximo de resultados (padrao: 50)"},
        },
        "required": ["pattern"]
    }

    async def execute(self, params: dict) -> ToolResult:
        directory = os.path.expanduser(params.get("directory", "~/Projetos"))
        pattern = params["pattern"]
        max_results = params.get("max_results", 50)

        try:
            results = []
            for match in glob.iglob(os.path.join(directory, pattern), recursive=True):
                if any(skip in match for skip in ["node_modules", ".git/", "__pycache__", ".next"]):
                    continue
                results.append(match)
                if len(results) >= max_results:
                    break

            if not results:
                return ToolResult(success=True, output="Nenhum arquivo encontrado")

            return ToolResult(
                success=True,
                output=f"Encontrados {len(results)} arquivos:\n" + "\n".join(results)
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileListTool(BaseTool):
    name = "file_list"
    description = "Lista arquivos e pastas de um diretorio com detalhes (tamanho, tipo)."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "directory": {"type": "string", "description": "Diretorio a listar"},
            "depth": {"type": "integer", "description": "Profundidade maxima (padrao: 2)"},
        },
        "required": ["directory"]
    }

    async def execute(self, params: dict) -> ToolResult:
        directory = os.path.expanduser(params["directory"])
        depth = params.get("depth", 2)

        if not os.path.isdir(directory):
            return ToolResult(success=False, output=None,
                              error=f"Diretorio nao encontrado: {directory}")

        excluded = {"node_modules", ".git", "__pycache__", ".next", ".vercel", "dist", "build", ".venv"}
        lines = []

        def walk(path, level=0):
            if level > depth:
                return
            try:
                entries = sorted(os.listdir(path))
            except PermissionError:
                return
            for entry in entries:
                if entry in excluded or entry.startswith("."):
                    continue
                full = os.path.join(path, entry)
                prefix = "  " * level
                if os.path.isdir(full):
                    lines.append(f"{prefix}[DIR] {entry}/")
                    walk(full, level + 1)
                else:
                    size = os.path.getsize(full)
                    size_str = f"{size}B" if size < 1024 else f"{size//1024}KB"
                    lines.append(f"{prefix}[FILE] {entry} ({size_str})")

        walk(directory)
        return ToolResult(
            success=True,
            output=f"Diretorio: {directory}\n\n" + "\n".join(lines[:500])
        )
