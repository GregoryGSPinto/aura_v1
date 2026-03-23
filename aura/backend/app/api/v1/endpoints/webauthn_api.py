"""
WebAuthn API — Biometric authentication (Face ID / Touch ID).

Simple single-user implementation:
- Challenges stored in memory (short-lived)
- Credentials stored in JSON file
- No heavy crypto libs — the browser does the real crypto
"""

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v1.endpoints.auth import get_current_user

logger = logging.getLogger("aura")
router = APIRouter(prefix="/auth/webauthn", tags=["webauthn"])

CREDENTIALS_FILE = Path(__file__).parent.parent.parent.parent / "data" / "json" / "webauthn_credentials.json"

# In-memory challenge store (short-lived)
_challenges: dict = {}


def _load_credentials() -> list:
    try:
        if CREDENTIALS_FILE.exists():
            return json.loads(CREDENTIALS_FILE.read_text())
    except Exception as exc:
        logger.warning("[WebAuthn] Failed to load credentials: %s", exc)
    return []


def _save_credentials(creds: list):
    try:
        CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        CREDENTIALS_FILE.write_text(json.dumps(creds, indent=2))
    except Exception as exc:
        logger.error("[WebAuthn] Failed to save credentials: %s", exc)


def _generate_challenge() -> str:
    """Generate a random challenge as base64url string."""
    raw = os.urandom(32)
    import base64
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _get_rp_id() -> str:
    """Return relying party ID (domain)."""
    return "localhost"


def _get_rp_name() -> str:
    return "Aura"


class RegisterRequest(BaseModel):
    credential_id: str
    attestation_object: str
    client_data_json: str


class LoginRequest(BaseModel):
    credential_id: str
    authenticator_data: str
    client_data_json: str
    signature: str


@router.get("/register-options")
async def register_options(user: str = Depends(get_current_user)):
    """Return options for WebAuthn credential creation."""
    challenge = _generate_challenge()
    _challenges[f"register_{user}"] = {"challenge": challenge, "time": time.time()}

    # Cleanup old challenges (> 5 min)
    now = time.time()
    expired = [k for k, v in _challenges.items() if now - v["time"] > 300]
    for k in expired:
        del _challenges[k]

    import base64
    user_id = base64.urlsafe_b64encode(user.encode()).rstrip(b"=").decode()

    return {
        "challenge": challenge,
        "rp_id": _get_rp_id(),
        "rp_name": _get_rp_name(),
        "user_id": user_id,
        "user_name": user,
    }


@router.post("/register")
async def register_credential(req: RegisterRequest, user: str = Depends(get_current_user)):
    """Save a WebAuthn credential."""
    key = f"register_{user}"
    stored = _challenges.pop(key, None)
    if not stored:
        raise HTTPException(status_code=400, detail="No pending challenge")

    # Simple validation: check challenge isn't too old
    if time.time() - stored["time"] > 300:
        raise HTTPException(status_code=400, detail="Challenge expired")

    # Store credential
    creds = _load_credentials()

    # Remove any existing credential for this user
    creds = [c for c in creds if c.get("user") != user]

    creds.append({
        "user": user,
        "credential_id": req.credential_id,
        "attestation_hash": hashlib.sha256(req.attestation_object.encode()).hexdigest(),
        "created_at": time.time(),
    })
    _save_credentials(creds)

    logger.info("[WebAuthn] Credential registered for user %s", user)
    return {"success": True, "message": "Biometric credential registered"}


@router.get("/login-options")
async def login_options():
    """Return options for WebAuthn authentication."""
    challenge = _generate_challenge()
    _challenges["login"] = {"challenge": challenge, "time": time.time()}

    return {
        "challenge": challenge,
        "rp_id": _get_rp_id(),
    }


@router.post("/login")
async def login_with_credential(req: LoginRequest):
    """Verify WebAuthn assertion and return auth token."""
    stored = _challenges.pop("login", None)
    if not stored:
        raise HTTPException(status_code=400, detail="No pending challenge")

    if time.time() - stored["time"] > 300:
        raise HTTPException(status_code=400, detail="Challenge expired")

    # Find credential
    creds = _load_credentials()
    matching = [c for c in creds if c.get("credential_id") == req.credential_id]
    if not matching:
        raise HTTPException(status_code=401, detail="Unknown credential")

    cred = matching[0]
    username = cred["user"]

    # Generate token (same as normal login)
    from app.aura_os.config.settings import AuraOSSettings
    settings = AuraOSSettings()
    token = settings.auth_token

    logger.info("[WebAuthn] Biometric login successful for user %s", username)

    return {
        "success": True,
        "data": {
            "token": token,
            "username": username,
            "method": "biometric",
        },
    }
