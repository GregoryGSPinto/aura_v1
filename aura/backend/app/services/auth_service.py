from typing import Optional

from app.core.config import Settings
from app.core.exceptions import AuthError
from app.services.supabase_service import SupabaseService


class AuthService:
    def __init__(self, settings: Settings, supabase_service: SupabaseService):
        self.settings = settings
        self.supabase_service = supabase_service

    def validate_token(self, token: Optional[str]) -> dict:
        if not self.settings.require_auth:
            return {
                "auth_required": False,
                "authenticated": True,
                "auth_mode": self.settings.auth_mode,
                "provider": "disabled",
                "user_id": "local-dev",
            }

        local_valid = bool(token and token == self.settings.auth_token)
        if self.settings.auth_mode in {"local", "dual"} and local_valid:
            return {
                "auth_required": True,
                "authenticated": True,
                "auth_mode": self.settings.auth_mode,
                "provider": "local-token",
                "user_id": "local-operator",
            }

        if self.settings.auth_mode in {"supabase", "dual"} and token and self.supabase_service.is_enabled():
            try:
                user = self.supabase_service.get_authenticated_user(token)
                return {
                    "auth_required": True,
                    "authenticated": True,
                    "auth_mode": self.settings.auth_mode,
                    "provider": "supabase-auth",
                    "user_id": user.get("id") or user.get("email"),
                }
            except Exception:
                pass

        raise AuthError()

    def get_status(self, token: Optional[str]) -> dict:
        try:
            result = self.validate_token(token)
            return result
        except AuthError:
            return {
                "auth_required": self.settings.require_auth,
                "authenticated": False,
                "auth_mode": self.settings.auth_mode,
                "provider": "none",
                "user_id": None,
            }
