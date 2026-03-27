"""
Sprint 3 — Memory API endpoints.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/memory", tags=["memory"])


def _get_mem(request: Request):
    mem = getattr(request.app.state, "sqlite_memory", None)
    if not mem:
        raise AuraError("memory_unavailable", "Memory service not initialized.", status_code=503)
    return mem


# ── Preferences ─────────────────────────────────────────────────


class SetPreferenceRequest(BaseModel):
    category: str = Field(min_length=1)
    value: str = Field(min_length=1)
    source: str = "explicit"


@router.get("/preferences", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_preferences(request: Request, category: Optional[str] = None):
    mem = _get_mem(request)
    return ApiResponse(data=mem.get_preferences(category=category))


@router.put("/preferences/{key}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def update_preference(key: str, body: SetPreferenceRequest, request: Request):
    mem = _get_mem(request)
    result = mem.set_preference(body.category, key, body.value, body.source)
    return ApiResponse(data=result)


@router.delete("/preferences/{key}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def delete_preference(key: str, request: Request):
    mem = _get_mem(request)
    deleted = mem.delete_preference(key)
    return ApiResponse(data={"key": key, "deleted": deleted})


# ── Projects ────────────────────────────────────────────────────


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    stack: Optional[list] = None
    status: Optional[str] = None
    repo_url: Optional[str] = None
    deploy_url: Optional[str] = None
    directory: Optional[str] = None
    notes: Optional[str] = None
    next_steps: Optional[list] = None


@router.get("/projects", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_memory_projects(request: Request, status: Optional[str] = None):
    mem = _get_mem(request)
    return ApiResponse(data=mem.get_all_projects(status=status))


@router.get("/projects/{slug}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_memory_project(slug: str, request: Request):
    mem = _get_mem(request)
    project = mem.get_project(slug)
    if not project:
        raise AuraError("project_not_found", f"Project '{slug}' not found in memory.", status_code=404)
    return ApiResponse(data=project)


@router.put("/projects/{slug}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def update_memory_project(slug: str, body: UpdateProjectRequest, request: Request):
    mem = _get_mem(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = mem.update_project(slug, **updates)
    if not result:
        raise AuraError("project_not_found", f"Project '{slug}' not found.", status_code=404)
    return ApiResponse(data=result)


# ── Session Memory ──────────────────────────────────────────────


class AddSessionMemoryRequest(BaseModel):
    key: str = Field(min_length=1)
    value: str = Field(min_length=1)


@router.get("/session/{session_id}", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_session_context(session_id: str, request: Request):
    mem = _get_mem(request)
    return ApiResponse(data=mem.get_session_context(session_id))


@router.post("/session/{session_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def add_session_memory(session_id: str, body: AddSessionMemoryRequest, request: Request):
    mem = _get_mem(request)
    result = mem.add_session_memory(session_id, body.key, body.value)
    return ApiResponse(data=result)


# ── Context Search ──────────────────────────────────────────────


@router.get("/context", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_relevant_context(request: Request, query: str = "", project: Optional[str] = None):
    mem = _get_mem(request)
    if not query:
        return ApiResponse(data=[])
    return ApiResponse(data=mem.get_relevant_context(query, project_slug=project))


# ── Long Memory ─────────────────────────────────────────────────


class AddLongMemoryRequest(BaseModel):
    category: str = Field(min_length=1)
    content: str = Field(min_length=1)
    project_slug: Optional[str] = None
    expires_at: Optional[str] = None


@router.get("/long", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_long_memories(request: Request, category: Optional[str] = None, project: Optional[str] = None, limit: int = 20):
    mem = _get_mem(request)
    return ApiResponse(data=mem.get_long_memories(category=category, project_slug=project, limit=min(limit, 100)))


@router.post("/long", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def add_long_memory(body: AddLongMemoryRequest, request: Request):
    mem = _get_mem(request)
    result = mem.add_long_memory(body.category, body.content, body.project_slug, body.expires_at)
    return ApiResponse(data=result)


@router.delete("/long/{memory_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def delete_long_memory(memory_id: int, request: Request):
    mem = _get_mem(request)
    deleted = mem.delete_long_memory(memory_id)
    return ApiResponse(data={"id": memory_id, "deleted": deleted})


# ── Facts (via MemoryEngine) ─────────────────────────────────


class AddFactRequest(BaseModel):
    project_id: Optional[str] = None
    fact_type: str = Field(min_length=1)
    content: str = Field(min_length=1)


def _get_memory_engine(request: Request):
    engine = getattr(request.app.state, "memory_engine", None)
    if not engine:
        raise AuraError("memory_engine_unavailable", "Memory engine not initialized.", status_code=503)
    return engine


@router.post("/facts", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def add_fact(body: AddFactRequest, request: Request):
    engine = _get_memory_engine(request)
    result = await engine.add_fact(body.project_id, body.fact_type, body.content)
    return ApiResponse(data=result)


@router.get("/facts", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_facts(request: Request, project_id: Optional[str] = None, limit: int = 20):
    engine = _get_memory_engine(request)
    return ApiResponse(data=await engine.get_facts(project_id=project_id, limit=min(limit, 100)))


# ── Conversations ────────────────────────────────────────────


@router.get("/conversations", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_conversations(request: Request, limit: int = 10):
    engine = _get_memory_engine(request)
    return ApiResponse(data=await engine.get_recent_conversations(limit=min(limit, 50)))


# ── Context Formatted ────────────────────────────────────────


@router.get("/context/formatted", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_formatted_context(request: Request, project_id: Optional[str] = None):
    engine = _get_memory_engine(request)
    ctx = await engine.get_context_for_prompt(project_id=project_id)
    return ApiResponse(data={"context": ctx})


# ── Learn (force fact extraction) ────────────────────────────


class LearnRequest(BaseModel):
    text: str = Field(min_length=1)
    project_id: Optional[str] = None


@router.post("/learn", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def force_learn(body: LearnRequest, request: Request):
    engine = _get_memory_engine(request)
    result = await engine.add_fact(
        project_id=body.project_id,
        fact_type="learned",
        content=body.text[:500],
    )
    return ApiResponse(data=result)
