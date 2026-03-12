from typing import Optional

from fastapi import APIRouter, Depends, Header

from app.core.security_policies import limit_auth_requests
from app.models.auth_models import AuthStatus
from app.models.common_models import ApiResponse


router = APIRouter()


@router.get("/status", response_model=ApiResponse[AuthStatus], dependencies=[Depends(limit_auth_requests)])
async def auth_status(authorization: Optional[str] = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    from app.main import get_container

    auth_service = get_container().auth_service
    return ApiResponse(data=AuthStatus(**auth_service.get_status(token)))
