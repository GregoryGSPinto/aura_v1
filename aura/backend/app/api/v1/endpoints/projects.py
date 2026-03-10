from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.project_models import OpenProjectRequest, ProjectListResponse, ProjectOpenResult


router = APIRouter()


@router.get("/projects", response_model=ApiResponse[ProjectListResponse], dependencies=[Depends(require_bearer_token)])
async def list_projects(request: Request):
    projects = request.app.state.project_service.list_projects()
    return ApiResponse(data=ProjectListResponse(projects=projects, total=len(projects)))


@router.post("/projects/open", response_model=ApiResponse[ProjectOpenResult], dependencies=[Depends(require_bearer_token)])
async def open_project(request_body: OpenProjectRequest, request: Request):
    result = request.app.state.project_service.open_project(request_body.name)
    return ApiResponse(data=result)

