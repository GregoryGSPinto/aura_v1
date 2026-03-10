from fastapi import APIRouter, Depends, Request

from app.aura_os.config.models import AuraOSExecutionRequest, AuraOSExecutionResponse, AuraOSOverview
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/os", tags=["aura-os"])


@router.get("/overview", response_model=ApiResponse[AuraOSOverview], dependencies=[Depends(require_bearer_token)])
async def get_os_overview(request: Request):
    overview = await request.app.state.aura_os.overview()
    return ApiResponse(data=overview)


@router.post("/agent/execute", response_model=ApiResponse[AuraOSExecutionResponse], dependencies=[Depends(require_bearer_token)])
async def execute_os_goal(request_body: AuraOSExecutionRequest, request: Request):
    result = request.app.state.aura_os.execute(request_body)
    return ApiResponse(data=result)


@router.get("/agents", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def list_os_agents(request: Request):
    return ApiResponse(data=request.app.state.aura_os.agent_router.list_agents())
