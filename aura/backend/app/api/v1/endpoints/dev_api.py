"""
Rotas FastAPI para o AuraDev.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.tools.aura_dev import (
    dev, fix_error, add_feature, code_review, generate_tests,
    Provider, get_project_tree, read_file, run_command,
)

router = APIRouter(prefix="/dev", tags=["AuraDev"])


# ── Schemas ──

class DevRequest(BaseModel):
    task: str
    provider: Optional[str] = None  # "qwen" | "claude" | None
    project: Optional[str] = None
    context_patterns: Optional[list[str]] = None
    write_output: bool = False

class FixRequest(BaseModel):
    error_message: str
    file_path: str
    project: Optional[str] = None

class FeatureRequest(BaseModel):
    description: str
    project: str
    files: Optional[list[str]] = None

class ReviewRequest(BaseModel):
    file_path: str
    project: Optional[str] = None

class TestRequest(BaseModel):
    file_path: str
    project: Optional[str] = None

class CommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = None

class ReadFileRequest(BaseModel):
    path: str


# ── Rotas ──

@router.post("/task")
async def dev_task(req: DevRequest):
    """Tarefa genérica de desenvolvimento."""
    result = await dev(
        task=req.task,
        provider=req.provider,
        project=req.project,
        context_patterns=req.context_patterns,
        write_output=req.write_output,
    )
    return result.to_dict()


@router.post("/fix")
async def fix_error_route(req: FixRequest):
    """Corrige um erro a partir do traceback."""
    result = await fix_error(req.error_message, req.file_path, req.project)
    return result.to_dict()


@router.post("/feature")
async def add_feature_route(req: FeatureRequest):
    """Adiciona uma nova feature ao projeto."""
    result = await add_feature(req.description, req.project, req.files)
    return result.to_dict()


@router.post("/review")
async def code_review_route(req: ReviewRequest):
    """Code review profundo (sempre Claude)."""
    result = await code_review(req.file_path, req.project)
    return result.to_dict()


@router.post("/tests")
async def generate_tests_route(req: TestRequest):
    """Gera testes para um arquivo."""
    result = await generate_tests(req.file_path, req.project)
    return result.to_dict()


@router.post("/run")
async def run_command_route(req: CommandRequest):
    """Executa comando no terminal (L2 — verificação de segurança)."""
    return run_command(req.command, req.cwd)


@router.post("/read")
async def read_file_route(req: ReadFileRequest):
    """Lê um arquivo (L1)."""
    content = read_file(req.path)
    return {"path": req.path, "content": content}


@router.get("/tree/{project}")
async def project_tree(project: str, depth: int = 3):
    """Retorna a estrutura do projeto."""
    import os
    project_path = os.path.join(os.path.expanduser("~/Projetos"), project)
    if not os.path.exists(project_path):
        raise HTTPException(404, f"Projeto não encontrado: {project}")
    tree = get_project_tree(project_path, depth)
    return {"project": project, "tree": tree}


@router.get("/health")
async def health():
    """Health check do AuraDev."""
    import httpx
    ollama_ok = False
    claude_ok = False

    # Checa Ollama
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            ollama_ok = resp.status_code == 200
    except Exception:
        pass

    # Checa Claude Code CLI
    try:
        import subprocess
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True, text=True, timeout=5,
        )
        claude_ok = result.returncode == 0
    except Exception:
        pass

    return {
        "status": "ok" if (ollama_ok or claude_ok) else "degraded",
        "ollama": ollama_ok,
        "claude_code": claude_ok,
        "qwen_model": "qwen3:latest",
    }
