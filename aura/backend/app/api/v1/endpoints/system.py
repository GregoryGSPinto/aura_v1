from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


router = APIRouter(prefix="/system")


@router.get("/status", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_system_status(request: Request):
    settings = request.app.state.settings
    llm_status = await request.app.state.ollama_service.check_health()
    return ApiResponse(
        data=request.app.state.system_tool.summary(
            backend_status="online",
            llm_status=llm_status,
            persistence_mode=request.app.state.persistence_service.get_state().mode,
            auth_mode=settings.auth_mode,
        )
    )


@router.get("/cpu", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_cpu(request: Request):
    return ApiResponse(data=request.app.state.system_tool.cpu())


@router.get("/memory", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_memory(request: Request):
    return ApiResponse(data=request.app.state.system_tool.memory())


@router.get("/disk", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_disk(request: Request):
    return ApiResponse(data=request.app.state.system_tool.disk())


@router.get("/metrics", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_metrics(request: Request):
    cpu = request.app.state.system_tool.cpu()
    memory = request.app.state.system_tool.memory()
    disk = request.app.state.system_tool.disk()
    processes = request.app.state.system_tool.processes(limit=15)
    return ApiResponse(
        data={
            "cpu": cpu.get("usage_percent", 0.0),
            "memory": memory.get("usage_percent", 0.0),
            "disk": disk.get("usage_percent", 0.0),
            "network": {"upload": 0, "download": 0},
            "processes": processes,
            "timestamp": request.app.state.system_tool.summary(
                backend_status="online",
                llm_status="unknown",
                persistence_mode=request.app.state.persistence_service.get_state().mode,
                auth_mode=request.app.state.settings.auth_mode,
            )["timestamp"],
        }
    )


@router.get("/processes", response_model=ApiResponse[list[dict]], dependencies=[Depends(require_bearer_token)])
async def get_processes(request: Request):
    return ApiResponse(data=request.app.state.system_tool.processes(limit=20))
