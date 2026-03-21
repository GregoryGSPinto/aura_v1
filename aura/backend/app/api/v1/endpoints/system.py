from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse


class ProviderOverrideRequest(BaseModel):
    provider: str


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


@router.get("/engine/status", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_engine_status(request: Request):
    engine = request.app.state.ollama_engine_service
    data = await engine.get_status()
    return ApiResponse(data=data)


@router.post("/engine/start", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def start_engine(request: Request):
    engine = request.app.state.ollama_engine_service
    data = await engine.start()
    return ApiResponse(data=data)


@router.post("/engine/stop", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def stop_engine(request: Request):
    engine = request.app.state.ollama_engine_service
    data = await engine.stop()
    return ApiResponse(data=data)


@router.get("/providers", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_providers(request: Request):
    providers = request.app.state.chat_providers
    statuses = {}
    for name, provider in providers.items():
        try:
            import inspect
            status = provider.status()
            if inspect.isawaitable(status):
                status = await status
            statuses[name] = {
                "status": "online" if status.available else "offline",
                "model": status.model,
                "configured": status.configured,
                "details": status.details,
            }
        except Exception as exc:
            statuses[name] = {"status": "error", "error": str(exc)}
    override = getattr(request.app.state, "provider_override", "auto")
    return ApiResponse(data={
        "providers": statuses,
        "override": override if override != "auto" else None,
        "mode": "manual" if override != "auto" else "auto",
        "active_provider": override if override != "auto" else "ollama",
    })


@router.post("/provider/override", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def set_provider_override(body: ProviderOverrideRequest, request: Request):
    valid_providers = {"auto", "ollama", "anthropic", "openai"}
    if body.provider not in valid_providers:
        from app.core.exceptions import AuraError
        raise AuraError("invalid_provider", f"Provider invalido: {body.provider}. Validos: {', '.join(sorted(valid_providers))}")

    if body.provider not in {"auto", "ollama"}:
        provider_instance = request.app.state.chat_providers.get(body.provider)
        if not provider_instance:
            from app.core.exceptions import AuraError
            raise AuraError("provider_not_found", f"Provider {body.provider} nao registrado.")
        import inspect
        status = provider_instance.status()
        if inspect.isawaitable(status):
            status = await status
        if not status.configured:
            from app.core.exceptions import AuraError
            raise AuraError("provider_not_configured", f"Provider {body.provider} nao configurado. Defina a API key no .env.")

    request.app.state.provider_override = body.provider
    model_router = request.app.state.aura_os.model_router
    model_router.set_override(body.provider if body.provider != "auto" else None)

    active = body.provider if body.provider != "auto" else "ollama"
    return ApiResponse(data={
        "success": True,
        "active_provider": active,
        "mode": "manual" if body.provider != "auto" else "auto",
    })
