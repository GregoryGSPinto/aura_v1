from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.job_models import JobCreateRequest, JobListResponse, JobRecord, JobStats


router = APIRouter()


@router.get("/jobs", response_model=ApiResponse[JobListResponse], dependencies=[Depends(require_bearer_token)])
async def list_jobs(request: Request):
    return ApiResponse(data=request.app.state.job_service.list_jobs())


@router.post("/jobs", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def create_job(request_body: JobCreateRequest, request: Request):
    return ApiResponse(data=request.app.state.job_service.create_job(request_body))


@router.get("/jobs/stats", response_model=ApiResponse[JobStats], dependencies=[Depends(require_bearer_token)])
async def job_stats(request: Request):
    return ApiResponse(data=request.app.state.job_service.get_stats())


@router.get("/jobs/{job_id}", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def get_job(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.job_service.get_job(job_id))


@router.post("/jobs/{job_id}/cancel", response_model=ApiResponse[JobRecord], dependencies=[Depends(require_bearer_token)])
async def cancel_job(job_id: str, request: Request):
    return ApiResponse(data=request.app.state.job_service.cancel_job(job_id))

