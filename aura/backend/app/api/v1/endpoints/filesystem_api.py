"""
Filesystem API — CRUD de arquivos do projeto.

Endpoints:
- GET  /api/v1/files/tree?path=...&depth=3  -> arvore de diretorios
- GET  /api/v1/files/read?path=...           -> conteudo do arquivo
- POST /api/v1/files/write                    -> salvar arquivo
- POST /api/v1/files/create                   -> criar arquivo/pasta
- GET  /api/v1/files/search?query=...        -> buscar arquivos por nome

Seguranca:
- TODOS os paths sao resolvidos relativos ao PROJECTS_ROOT
- Path traversal bloqueado (../ nao permitido fora do root)
- Arquivos binarios retornam erro (so texto)
- .env, .git/objects, node_modules sao excluidos da tree
- Requires auth token
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel

from app.core.security import require_bearer_token

router = APIRouter(prefix="/files", dependencies=[Depends(require_bearer_token)])

# Diretorios excluidos da tree
EXCLUDED_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", ".vercel",
    ".pytest_cache", "dist", "build", ".venv", "venv",
    ".mypy_cache", ".ruff_cache", "coverage",
}

# Extensoes de arquivo text (editaveis)
TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt",
    ".html", ".css", ".scss", ".yaml", ".yml", ".toml", ".cfg",
    ".sh", ".bash", ".zsh", ".gitignore",
    ".sql", ".graphql", ".xml", ".csv", ".ini", ".conf",
    ".lock", ".log",
}

# Nomes de arquivo sem extensao que sao texto
TEXT_FILENAMES = {
    "Makefile", "Dockerfile", "Procfile", "Gemfile",
    ".gitignore", ".dockerignore", ".editorconfig",
    ".env.example",
}

# Arquivos sensiveis (nunca expostos)
SENSITIVE_FILES = {".env", ".env.local", ".env.production"}


class WriteFileRequest(BaseModel):
    path: str
    content: str


class CreateFileRequest(BaseModel):
    path: str
    is_directory: bool = False


def _get_projects_root(request: Request) -> str:
    """Retorna o root dos projetos."""
    return getattr(
        request.app.state.settings,
        "default_projects_root",
        os.path.expanduser("~/Projetos"),
    )


def _safe_resolve(base: str, relative_path: str) -> Optional[str]:
    """Resolve path com seguranca — bloqueia path traversal."""
    base = os.path.realpath(base)
    if relative_path.startswith("/"):
        relative_path = relative_path.lstrip("/")
    full = os.path.realpath(os.path.join(base, relative_path))
    if not full.startswith(base):
        return None
    return full


def _is_text_file(name: str) -> bool:
    """Verifica se arquivo e editavel como texto."""
    if name in TEXT_FILENAMES:
        return True
    _, ext = os.path.splitext(name)
    return ext.lower() in TEXT_EXTENSIONS


@router.get("/tree")
async def file_tree(
    request: Request,
    path: str = Query("aura_v1", description="Path relativo ao projects root"),
    depth: int = Query(3, ge=1, le=5),
):
    """Retorna arvore de diretorios."""
    root = _get_projects_root(request)
    target = _safe_resolve(root, path)
    if not target or not os.path.isdir(target):
        return {"success": False, "error": {"message": "Diretorio nao encontrado"}}

    def build_tree(dir_path: str, current_depth: int) -> list:
        if current_depth <= 0:
            return []
        items = []
        try:
            entries = sorted(os.listdir(dir_path))
        except PermissionError:
            return []

        dirs = []
        files = []

        for entry in entries:
            if entry.startswith(".") and entry not in {".gitignore", ".env.example", ".editorconfig"}:
                continue
            if entry in EXCLUDED_DIRS:
                continue

            full_path = os.path.join(dir_path, entry)
            rel_path = os.path.relpath(full_path, root)

            if os.path.isdir(full_path):
                children = build_tree(full_path, current_depth - 1)
                dirs.append({
                    "name": entry,
                    "path": rel_path,
                    "type": "directory",
                    "children": children,
                })
            else:
                if entry in SENSITIVE_FILES:
                    continue
                is_text = _is_text_file(entry)
                files.append({
                    "name": entry,
                    "path": rel_path,
                    "type": "file",
                    "editable": is_text,
                    "size": os.path.getsize(full_path),
                })

        return dirs + files

    tree = build_tree(target, depth)
    return {"success": True, "data": {"path": path, "tree": tree}}


@router.get("/read")
async def read_file(
    request: Request,
    path: str = Query(..., description="Path relativo ao projects root"),
):
    """Le conteudo de um arquivo texto."""
    root = _get_projects_root(request)
    target = _safe_resolve(root, path)

    if not target:
        return {"success": False, "error": {"message": "Path invalido"}}
    if not os.path.isfile(target):
        return {"success": False, "error": {"message": "Arquivo nao encontrado"}}

    name = os.path.basename(target)
    if name in SENSITIVE_FILES:
        return {"success": False, "error": {"message": "Arquivo sensivel — nao pode ser lido pela interface"}}

    if not _is_text_file(name):
        _, ext = os.path.splitext(name)
        return {"success": False, "error": {"message": f"Tipo de arquivo nao suportado: {ext}"}}

    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as exc:
        return {"success": False, "error": {"message": str(exc)}}

    _, ext = os.path.splitext(name)
    return {
        "success": True,
        "data": {
            "path": path,
            "name": name,
            "content": content,
            "language": _detect_language(ext),
            "size": len(content),
        },
    }


@router.post("/write")
async def write_file(request: Request, body: WriteFileRequest):
    """Salva conteudo em um arquivo."""
    root = _get_projects_root(request)
    target = _safe_resolve(root, body.path)

    if not target:
        return {"success": False, "error": {"message": "Path invalido"}}

    name = os.path.basename(target)
    if name in SENSITIVE_FILES:
        return {"success": False, "error": {"message": "Nao pode editar arquivos sensiveis pela interface"}}

    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(body.content)
    except Exception as exc:
        return {"success": False, "error": {"message": str(exc)}}

    return {"success": True, "data": {"path": body.path, "saved": True}}


@router.post("/create")
async def create_file(request: Request, body: CreateFileRequest):
    """Cria arquivo ou diretorio."""
    root = _get_projects_root(request)
    target = _safe_resolve(root, body.path)

    if not target:
        return {"success": False, "error": {"message": "Path invalido"}}

    try:
        if body.is_directory:
            os.makedirs(target, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            Path(target).touch()
    except Exception as exc:
        return {"success": False, "error": {"message": str(exc)}}

    return {"success": True, "data": {"path": body.path, "created": True}}


@router.get("/search")
async def search_files(
    request: Request,
    query: str = Query(..., min_length=1),
    path: str = Query("aura_v1"),
):
    """Busca arquivos por nome (Ctrl+P quick open)."""
    root = _get_projects_root(request)
    target = _safe_resolve(root, path)

    if not target or not os.path.isdir(target):
        return {"success": False, "error": {"message": "Diretorio nao encontrado"}}

    results = []
    query_lower = query.lower()

    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith(".")]

        for filename in filenames:
            if query_lower in filename.lower():
                full = os.path.join(dirpath, filename)
                rel = os.path.relpath(full, root)
                results.append({
                    "name": filename,
                    "path": rel,
                    "directory": os.path.relpath(dirpath, root),
                })
                if len(results) >= 20:
                    break
        if len(results) >= 20:
            break

    return {"success": True, "data": {"query": query, "results": results}}


def _detect_language(ext: str) -> str:
    """Detecta linguagem pela extensao."""
    mapping = {
        ".py": "python", ".ts": "typescript", ".tsx": "tsx",
        ".js": "javascript", ".jsx": "jsx", ".json": "json",
        ".md": "markdown", ".html": "html", ".css": "css",
        ".yaml": "yaml", ".yml": "yaml", ".sh": "bash",
        ".sql": "sql", ".xml": "xml", ".toml": "toml",
    }
    return mapping.get(ext.lower(), "plaintext")
