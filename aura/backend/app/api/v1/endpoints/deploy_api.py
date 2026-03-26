"""
Sprint 6 — GitHub + Vercel + Deploy Orchestrator endpoints.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.exceptions import AuraError
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(tags=["deploy"])


# ── GitHub ──────────────────────────────────────────────────────


class CreateRepoRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    private: bool = True


class CreateBranchRequest(BaseModel):
    branch: str = Field(min_length=1)
    from_branch: str = "main"


class CreateIssueRequest(BaseModel):
    title: str = Field(min_length=1)
    body: str = ""
    labels: Optional[List[str]] = None


class CreatePRRequest(BaseModel):
    title: str = Field(min_length=1)
    head: str = Field(min_length=1)
    base: str = "main"
    body: str = ""


@router.get("/github/repos", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_github_repos(request: Request, limit: int = 20):
    svc = getattr(request.app.state, "github_service", None)
    if not svc:
        return ApiResponse(data=[{"error": "GitHub service not configured"}])
    return ApiResponse(data=await svc.list_repos(limit=min(limit, 100)))


@router.post("/github/repos", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_github_repo(body: CreateRepoRequest, request: Request):
    svc = getattr(request.app.state, "github_service", None)
    if not svc or not svc.available:
        raise AuraError("github_not_configured", "Set GITHUB_TOKEN and GITHUB_USERNAME in .env", status_code=503)
    return ApiResponse(data=await svc.create_repo(body.name, body.description, body.private))


@router.get("/github/repos/{name}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_github_repo(name: str, request: Request):
    svc = getattr(request.app.state, "github_service", None)
    if not svc:
        raise AuraError("github_not_configured", "GitHub not configured", status_code=503)
    return ApiResponse(data=await svc.get_repo_status(name))


@router.post("/github/repos/{name}/branch", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_github_branch(name: str, body: CreateBranchRequest, request: Request):
    svc = getattr(request.app.state, "github_service", None)
    if not svc or not svc.available:
        raise AuraError("github_not_configured", "GitHub not configured", status_code=503)
    return ApiResponse(data=await svc.create_branch(name, body.branch, body.from_branch))


@router.post("/github/repos/{name}/issue", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_github_issue(name: str, body: CreateIssueRequest, request: Request):
    svc = getattr(request.app.state, "github_service", None)
    if not svc or not svc.available:
        raise AuraError("github_not_configured", "GitHub not configured", status_code=503)
    return ApiResponse(data=await svc.create_issue(name, body.title, body.body, body.labels))


@router.post("/github/repos/{name}/pr", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_github_pr(name: str, body: CreatePRRequest, request: Request):
    svc = getattr(request.app.state, "github_service", None)
    if not svc or not svc.available:
        raise AuraError("github_not_configured", "GitHub not configured", status_code=503)
    return ApiResponse(data=await svc.create_pull_request(name, body.title, body.head, body.base, body.body))


# ── Vercel ──────────────────────────────────────────────────────


class CreateVercelProjectRequest(BaseModel):
    name: str = Field(min_length=1)
    repo: Optional[str] = None
    framework: str = "nextjs"


class SetEnvVarsRequest(BaseModel):
    env_vars: Dict[str, str]
    target: Optional[List[str]] = None


@router.get("/vercel/projects", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def list_vercel_projects(request: Request, limit: int = 20):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc:
        return ApiResponse(data=[{"error": "Vercel not configured"}])
    return ApiResponse(data=await svc.list_projects(limit=min(limit, 100)))


@router.post("/vercel/projects", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def create_vercel_project(body: CreateVercelProjectRequest, request: Request):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc or not svc.available:
        raise AuraError("vercel_not_configured", "Set VERCEL_TOKEN in .env", status_code=503)
    return ApiResponse(data=await svc.create_project(body.name, body.repo, body.framework))


@router.get("/vercel/projects/{name}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_vercel_project(name: str, request: Request):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc:
        raise AuraError("vercel_not_configured", "Vercel not configured", status_code=503)
    return ApiResponse(data=await svc.get_project(name))


@router.post("/vercel/projects/{name}/env", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def set_vercel_env(name: str, body: SetEnvVarsRequest, request: Request):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc or not svc.available:
        raise AuraError("vercel_not_configured", "Vercel not configured", status_code=503)
    return ApiResponse(data=await svc.set_env_vars(name, body.env_vars, body.target))


@router.post("/vercel/projects/{name}/deploy", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def trigger_vercel_deploy(name: str, request: Request):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc or not svc.available:
        raise AuraError("vercel_not_configured", "Vercel not configured", status_code=503)
    return ApiResponse(data=await svc.trigger_deploy(name))


@router.get("/vercel/deployments/{deployment_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_vercel_deployment(deployment_id: str, request: Request):
    svc = getattr(request.app.state, "vercel_service", None)
    if not svc:
        raise AuraError("vercel_not_configured", "Vercel not configured", status_code=503)
    return ApiResponse(data=await svc.get_deployment_status(deployment_id))


# ── Deploy Orchestrator ─────────────────────────────────────────


class FullDeployRequest(BaseModel):
    project: str = Field(min_length=1)
    local_dir: str = Field(min_length=1)
    description: str = ""


@router.post("/deploy/full", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def full_deploy(body: FullDeployRequest, request: Request):
    orch = getattr(request.app.state, "deploy_orchestrator", None)
    if not orch:
        raise AuraError("deploy_unavailable", "Deploy orchestrator not configured", status_code=503)
    return ApiResponse(data=await orch.full_deploy_flow(body.project, body.local_dir, body.description))


@router.post("/deploy/redeploy/{project}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def redeploy(project: str, request: Request):
    orch = getattr(request.app.state, "deploy_orchestrator", None)
    if not orch:
        raise AuraError("deploy_unavailable", "Deploy orchestrator not configured", status_code=503)
    return ApiResponse(data=await orch.redeploy(project))


@router.get("/deploy/status/{project}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def deploy_status(project: str, request: Request):
    orch = getattr(request.app.state, "deploy_orchestrator", None)
    if not orch:
        raise AuraError("deploy_unavailable", "Deploy orchestrator not configured", status_code=503)
    return ApiResponse(data=await orch.check_project_deploy_status(project))
