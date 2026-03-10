from fastapi import APIRouter, Depends, Request

from app.agents.models import AgentExecutionResult, AgentGoalRequest, AgentPlan
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.job_models import JobListResponse, JobLogEntry, JobRecord, JobStepRequest


router = APIRouter(prefix="/agent")


@router.post("/jobs", response_model=ApiResponse[AgentExecutionResult], dependencies=[Depends(require_bearer_token)])
async def create_agent_job(request_body: AgentGoalRequest, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.create_job_from_goal(request_body))


@router.post("/plan", response_model=ApiResponse[AgentPlan], dependencies=[Depends(require_bearer_token)])
async def preview_agent_plan(request_body: AgentGoalRequest, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.create_plan(request_body))


@router.get("/jobs", response_model=ApiResponse[JobListResponse], dependencies=[Depends(require_bearer_token)])
async def list_agent_jobs(request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.list_jobs())


@router.get("/jobs/{job_id}", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def get_agent_job(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.get_job(job_id))


@router.post("/jobs/{job_id}/start", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def start_agent_job(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.start_job(job_id))


@router.post("/jobs/{job_id}/cancel", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def cancel_agent_job(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.cancel_job(job_id))


@router.get("/jobs/{job_id}/steps", response_model=ApiResponse[list[JobStepRequest]], dependencies=[Depends(require_bearer_token)])
async def list_agent_job_steps(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.get_steps(job_id))


@router.get("/jobs/{job_id}/logs", response_model=ApiResponse[list[JobLogEntry]], dependencies=[Depends(require_bearer_token)])
async def list_agent_job_logs(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.agent_job_manager.get_logs(job_id))
