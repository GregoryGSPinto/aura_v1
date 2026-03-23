"""
Push Notifications API — Subscribe, unsubscribe, test, VAPID key.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.security import require_bearer_token

router = APIRouter(prefix="/push", dependencies=[Depends(require_bearer_token)])


class SubscriptionBody(BaseModel):
    endpoint: str
    keys: dict
    expirationTime: Optional[int] = None


@router.get("/vapid-key")
async def get_vapid_key(request: Request):
    settings = request.app.state.settings
    return {"success": True, "data": {"public_key": settings.vapid_public_key}}


@router.post("/subscribe")
async def subscribe(body: SubscriptionBody, request: Request):
    push_service = request.app.state.push_service
    sub_info = {"endpoint": body.endpoint, "keys": body.keys}
    if body.expirationTime is not None:
        sub_info["expirationTime"] = body.expirationTime
    added = push_service.subscribe(sub_info)
    return {"success": True, "data": {"added": added, "total": push_service.subscription_count}}


@router.post("/unsubscribe")
async def unsubscribe(body: dict, request: Request):
    push_service = request.app.state.push_service
    removed = push_service.unsubscribe(body.get("endpoint", ""))
    return {"success": True, "data": {"removed": removed}}


@router.post("/test")
async def test_push(request: Request):
    push_service = request.app.state.push_service
    sent = push_service.send_notification(
        title="Aura — Teste",
        body="Push notification funcionando!",
        url="/chat",
        tag="test",
    )
    return {"success": True, "data": {"sent": sent, "total_subscriptions": push_service.subscription_count}}
