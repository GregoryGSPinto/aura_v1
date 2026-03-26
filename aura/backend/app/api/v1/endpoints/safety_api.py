"""Sprint 11 — Safety Layer API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, Request
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse

router = APIRouter(prefix="/safety", tags=["safety"])

@router.get("/pending", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_pending_approvals(request: Request):
    queue = getattr(request.app.state, "approval_queue", None)
    return ApiResponse(data=queue.get_pending() if queue else [])

@router.post("/approve/{request_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def approve_action(request_id: str, request: Request):
    queue = getattr(request.app.state, "approval_queue", None)
    if queue and queue.approve(request_id):
        return ApiResponse(data={"id": request_id, "approved": True})
    return ApiResponse(data={"id": request_id, "approved": False})

@router.post("/reject/{request_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def reject_action(request_id: str, request: Request):
    queue = getattr(request.app.state, "approval_queue", None)
    if queue and queue.reject(request_id):
        return ApiResponse(data={"id": request_id, "rejected": True})
    return ApiResponse(data={"id": request_id, "rejected": False})

@router.get("/rollbackable", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_rollbackable(request: Request):
    registry = getattr(request.app.state, "rollback_registry", None)
    return ApiResponse(data=registry.get_rollbackable() if registry else [])

@router.post("/rollback/{action_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def rollback_action(action_id: str, request: Request):
    registry = getattr(request.app.state, "rollback_registry", None)
    cmd = registry.rollback(action_id) if registry else None
    return ApiResponse(data={"action_id": action_id, "rollback_command": cmd, "executed": cmd is not None})

@router.get("/audit", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_audit_log(request: Request, limit: int = 50):
    audit = getattr(request.app.state, "audit_service", None)
    return ApiResponse(data=audit.get_recent(min(limit, 200)) if audit else [])

@router.get("/audit/summary", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_audit_summary(request: Request):
    audit = getattr(request.app.state, "audit_service", None)
    return ApiResponse(data=audit.get_summary() if audit else {})

@router.get("/audit/dangerous", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_dangerous_actions(request: Request, limit: int = 20):
    audit = getattr(request.app.state, "audit_service", None)
    return ApiResponse(data=audit.get_dangerous(min(limit, 100)) if audit else [])
