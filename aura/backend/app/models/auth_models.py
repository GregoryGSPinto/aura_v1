from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    token: str


class AuthStatus(BaseModel):
    auth_required: bool
    authenticated: bool
    auth_mode: str
    provider: str
    user_id: Optional[str] = None
