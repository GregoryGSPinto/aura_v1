from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/tools")


# ── Sprint 4: Unified tool endpoints ────────────────────────────


class ToolExecuteRequest(BaseModel):
    tool: str = Field(min_length=1, description="Tool name in category.method format")
    params: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None


@router.get("", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_available_tools(request: Request):
    """List all registered tools with descriptions and risk levels."""
    registry = getattr(request.app.state, "tool_registry_v2", None)
    if not registry:
        return ApiResponse(data=[])
    return ApiResponse(data=registry.list_tools())


@router.post("/execute", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def execute_tool(request_body: ToolExecuteRequest, request: Request):
    """Execute a tool by name. Format: category.method (e.g., git.status)."""
    registry = getattr(request.app.state, "tool_registry_v2", None)
    if not registry:
        raise AuraError("tools_unavailable", "Tool registry not initialized.", status_code=503)
    result = await registry.execute(
        tool_name=request_body.tool,
        params=request_body.params,
        session_id=request_body.session_id,
    )
    return ApiResponse(data=result.to_dict())


@router.get("/history", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_tool_history(request: Request, limit: int = 20):
    """Return recent tool execution history."""
    registry = getattr(request.app.state, "tool_registry_v2", None)
    if not registry:
        return ApiResponse(data=[])
    return ApiResponse(data=registry.get_history(limit=min(limit, 100)))


class TerminalToolRequest(BaseModel):
    action: str = Field(min_length=1)
    project_name: Optional[str] = None
    cwd: Optional[str] = None


class ProjectsToolRequest(BaseModel):
    action: str = Field(min_length=1)
    name: Optional[str] = None
    script: Optional[str] = None


class FilesystemListRequest(BaseModel):
    path: Optional[str] = None


class FilesystemReadRequest(BaseModel):
    path: str


class FilesystemSearchRequest(BaseModel):
    query: str
    root: Optional[str] = None


class BrowserOpenRequest(BaseModel):
    url: str


class VSCodeOpenRequest(BaseModel):
    path: Optional[str] = None
    file_path: Optional[str] = None
    line: Optional[int] = None


@router.post("/terminal", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def run_terminal_tool(request_body: TerminalToolRequest, request: Request):
    project_path = None
    if request_body.project_name:
        project = request.app.state.project_tool.get_project(request_body.project_name)
        project_path = project.path

    cwd = request_body.cwd or project_path
    if cwd:
        cwd = request.app.state.filesystem_tool.ensure_allowed_path(cwd)
    normalized = request.app.state.terminal_tool.normalize_allowed_command(request_body.action)
    if not normalized:
        raise AuraError("tool_action_not_supported", f"Ação de terminal não suportada: {request_body.action}", status_code=400)
    result = request.app.state.terminal_tool.run_named_action(normalized, cwd=cwd)
    return ApiResponse(
        data={
            "action": normalized,
            "cwd": result.cwd,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    )


@router.get("/projects", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def list_tool_projects(request: Request):
    return ApiResponse(data=request.app.state.project_tool.list_projects())


@router.post("/projects", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def run_projects_tool(request_body: ProjectsToolRequest, request: Request):
    action = request_body.action.lower()
    if action == "open":
        return ApiResponse(data=request.app.state.project_tool.open_project(request_body.name or ""))
    if action == "inspect":
        return ApiResponse(data=request.app.state.project_tool.inspect_project(request_body.name or ""))
    if action == "run_script":
        return ApiResponse(data=request.app.state.project_tool.run_named_script(request_body.name or "", request_body.script or "dev"))
    raise AuraError("tool_action_not_supported", "Ação de projeto não suportada.", status_code=400)


@router.get("/system", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_tools_system(request: Request):
    return ApiResponse(
        data=request.app.state.system_tool.summary(
            backend_status="online",
            llm_status=await request.app.state.ollama_service.check_health(),
            persistence_mode=request.app.state.persistence_service.get_state().mode,
            auth_mode=request.app.state.settings.auth_mode,
        )
    )


@router.post("/filesystem/list", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def filesystem_list(request_body: FilesystemListRequest, request: Request):
    return ApiResponse(data=request.app.state.filesystem_tool.list_directory(request_body.path))


@router.post("/filesystem/read", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def filesystem_read(request_body: FilesystemReadRequest, request: Request):
    return ApiResponse(data=request.app.state.filesystem_tool.read_file(request_body.path))


@router.post("/filesystem/search", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def filesystem_search(request_body: FilesystemSearchRequest, request: Request):
    return ApiResponse(data=request.app.state.filesystem_tool.find_files(request_body.query, request_body.root))


@router.post("/filesystem/grep", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def filesystem_grep(request_body: FilesystemSearchRequest, request: Request):
    return ApiResponse(data=request.app.state.filesystem_tool.search_text(request_body.query, request_body.root))


@router.post("/browser/open", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def browser_open(request_body: BrowserOpenRequest, request: Request):
    return ApiResponse(data=request.app.state.browser_tool.open_url(request_body.url))


@router.post("/vscode/open", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def vscode_open(request_body: VSCodeOpenRequest, request: Request):
    if request_body.file_path:
        return ApiResponse(data=request.app.state.vscode_tool.open_file(request_body.file_path, request_body.line))
    if request_body.path:
        return ApiResponse(data=request.app.state.vscode_tool.open_path(request_body.path))
    return ApiResponse(data=request.app.state.vscode_tool.open_app())
