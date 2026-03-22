import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse

from app.core.security_policies import limit_auth_requests
from app.models.auth_models import AuthStatus, LoginCredentials, LoginResponse
from app.models.common_models import ApiResponse

logger = logging.getLogger("aura")

router = APIRouter()


@router.get("/status", response_model=ApiResponse[AuthStatus], dependencies=[Depends(limit_auth_requests)])
async def auth_status(request: Request, authorization: Optional[str] = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    return ApiResponse(data=AuthStatus(**request.app.state.auth_service.get_status(token)))


@router.post("/login", dependencies=[Depends(limit_auth_requests)])
async def login(request: Request, body: LoginCredentials):
    settings = request.app.state.settings

    expected_username = settings.aura_admin_username
    expected_password = settings.aura_admin_password

    if not expected_password:
        logger.warning("Login attempt but AURA_ADMIN_PASSWORD is not configured")
        return JSONResponse(
            status_code=401,
            content={"success": False, "data": None, "error": {"code": "auth_error", "message": "Login não configurado no servidor."}},
        )

    logger.info("Login attempt for user: %s", body.username)

    username_match = hmac.compare_digest(body.username.encode(), expected_username.encode())
    password_match = hmac.compare_digest(body.password.encode(), expected_password.encode())

    if username_match and password_match:
        token = settings.auth_token
        logger.info("Login successful for user: %s", body.username)
        return ApiResponse(data=LoginResponse(token=token, username=body.username))

    logger.warning("Login failed for user: %s", body.username)
    return JSONResponse(
        status_code=401,
        content={"success": False, "data": None, "error": {"code": "auth_error", "message": "Credenciais inválidas."}},
    )
