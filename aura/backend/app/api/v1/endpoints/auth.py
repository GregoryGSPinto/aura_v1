from typing import Optional

from fastapi import APIRouter, Depends, Header, Request

from app.core.security_policies import limit_auth_requests
from app.models.auth_models import AuthStatus
from app.models.common_models import ApiResponse


router = APIRouter()


@router.get("/status", response_model=ApiResponse[AuthStatus], dependencies=[Depends(limit_auth_requests)])
async def auth_status(request: Request, authorization: Optional[str] = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    return ApiResponse(data=AuthStatus(**request.app.state.auth_service.get_status(token)))
