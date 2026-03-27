"""Sprint 13.5 — Proactive Agent API endpoints."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse

router = APIRouter(prefix="/proactive", tags=["proactive"])

class OpinionRequest(BaseModel):
    topic: str
    context: str = ""

@router.get("/alerts", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_alerts(request: Request, limit: int = 20):
    engine = getattr(request.app.state, "proactive_engine", None)
    return ApiResponse(data=engine.get_alerts(limit) if engine else [])

@router.get("/insight", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_insight(request: Request):
    engine = getattr(request.app.state, "proactive_engine", None)
    if not engine:
        return ApiResponse(data={"insight": "Proactive engine not configured"})
    text = await engine.get_insight()
    return ApiResponse(data={"insight": text})

@router.post("/opinion", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_opinion(body: OpinionRequest, request: Request):
    engine = getattr(request.app.state, "proactive_engine", None)
    if not engine:
        return ApiResponse(data={"opinion": "Not available"})
    return ApiResponse(data=await engine.get_opinion(body.topic, body.context))

@router.get("/suggestions", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_suggestions(request: Request):
    engine = getattr(request.app.state, "proactive_engine", None)
    if not engine:
        return ApiResponse(data=[])
    return ApiResponse(data=await engine.get_suggestions())

@router.post("/dismiss/{alert_id}", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def dismiss_alert(alert_id: str, request: Request):
    engine = getattr(request.app.state, "proactive_engine", None)
    dismissed = engine.dismiss_alert(alert_id) if engine else False
    return ApiResponse(data={"alert_id": alert_id, "dismissed": dismissed})


@router.get("/greeting", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_greeting(request: Request):
    """Saudacao contextual quando Gregory abre o chat."""
    agent = getattr(request.app.state, "proactive_agent", None)
    if not agent:
        return ApiResponse(data={"greeting": None})
    greeting = await agent.get_greeting()
    return ApiResponse(data={"greeting": greeting})
