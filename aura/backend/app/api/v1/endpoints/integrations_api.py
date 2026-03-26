"""Sprint 9 — Calendar + Email + Docs API endpoints."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional
from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse

router = APIRouter(tags=["integrations"])

# Calendar
@router.get("/calendar/today", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def calendar_today(request: Request):
    svc = getattr(request.app.state, "calendar_service", None)
    if not svc:
        return ApiResponse(data=[{"error": "Calendar not configured"}])
    return ApiResponse(data=await svc.get_today_events())

@router.get("/calendar/week", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def calendar_week(request: Request):
    svc = getattr(request.app.state, "calendar_service", None)
    if not svc:
        return ApiResponse(data=[])
    return ApiResponse(data=await svc.get_week_events())

@router.get("/calendar/upcoming", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def calendar_upcoming(request: Request, hours: int = 4):
    svc = getattr(request.app.state, "calendar_service", None)
    if not svc:
        return ApiResponse(data=[])
    return ApiResponse(data=await svc.get_upcoming(hours))

@router.get("/calendar/briefing", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def calendar_briefing(request: Request):
    svc = getattr(request.app.state, "calendar_service", None)
    if not svc:
        return ApiResponse(data={"events": [], "total": 0, "configured": False})
    return ApiResponse(data=await svc.get_daily_briefing())

# Email
@router.get("/email/unread", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def email_unread(request: Request, limit: int = 10):
    svc = getattr(request.app.state, "email_service", None)
    if not svc:
        return ApiResponse(data=[{"error": "Email not configured"}])
    return ApiResponse(data=await svc.get_unread(min(limit, 50)))

@router.get("/email/briefing", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def email_briefing(request: Request):
    svc = getattr(request.app.state, "email_service", None)
    if not svc:
        return ApiResponse(data={"unread": [], "unread_count": 0, "configured": False})
    return ApiResponse(data=await svc.get_email_briefing())

# Docs
class DocReadRequest(BaseModel):
    path: str = Field(min_length=1)

class DocSummarizeRequest(BaseModel):
    path: str = Field(min_length=1)
    focus: str = ""

class DocSearchRequest(BaseModel):
    path: str = Field(min_length=1)
    query: str = Field(min_length=1)

@router.post("/docs/read", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def docs_read(body: DocReadRequest, request: Request):
    svc = getattr(request.app.state, "doc_service", None)
    if not svc:
        return ApiResponse(data={"error": "Doc service not configured"})
    return ApiResponse(data=await svc.read_file(body.path))

@router.post("/docs/summarize", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def docs_summarize(body: DocSummarizeRequest, request: Request):
    svc = getattr(request.app.state, "doc_service", None)
    if not svc:
        return ApiResponse(data={"error": "Doc service not configured"})
    return ApiResponse(data=await svc.summarize(body.path, body.focus))

@router.post("/docs/extract-actions", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def docs_extract_actions(body: DocReadRequest, request: Request):
    svc = getattr(request.app.state, "doc_service", None)
    if not svc:
        return ApiResponse(data=[])
    return ApiResponse(data=await svc.extract_actions(body.path))

# Briefing (Sprint 14)
@router.get("/briefing/daily", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def daily_briefing(request: Request):
    svc = getattr(request.app.state, "briefing_service", None)
    if not svc:
        return ApiResponse(data={"error": "Briefing service not configured"})
    return ApiResponse(data=await svc.generate_briefing())

@router.get("/briefing/priorities", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def briefing_priorities(request: Request):
    svc = getattr(request.app.state, "briefing_service", None)
    if not svc:
        return ApiResponse(data=[])
    return ApiResponse(data=await svc.get_focus_priorities())

@router.get("/briefing/quick", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def briefing_quick(request: Request):
    svc = getattr(request.app.state, "briefing_service", None)
    if not svc:
        return ApiResponse(data=[{"type": "status", "text": "Briefing not configured"}])
    return ApiResponse(data=await svc.get_quick_briefing())

# Voice (Sprint 12)
@router.get("/voice/premium/status", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def voice_premium_status(request: Request):
    stt = getattr(request.app.state, "stt_service", None)
    tts = getattr(request.app.state, "tts_service", None)
    return ApiResponse(data={
        "stt": stt.status() if stt else {"available": False},
        "tts": tts.status() if tts else {"available": False},
    })

@router.get("/voice/voices", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def voice_list_voices(request: Request):
    tts = getattr(request.app.state, "tts_service", None)
    if not tts:
        return ApiResponse(data=[])
    return ApiResponse(data=await tts.list_voices())

# Mission V2 enhancements (Sprint 15)
@router.get("/missions/{mission_id}/blockers", response_model=ApiResponse[list], dependencies=[Depends(require_bearer_token)])
async def get_mission_blockers(mission_id: str, request: Request):
    detector = getattr(request.app.state, "blocker_detector", None)
    store = getattr(request.app.state, "mission_store", None)
    if not detector or not store:
        return ApiResponse(data=[])
    mission = store.get(mission_id)
    if not mission:
        return ApiResponse(data=[])
    return ApiResponse(data=detector.check_blockers(mission.to_dict()))

@router.get("/missions/{mission_id}/evaluation", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_mission_evaluation(mission_id: str, request: Request):
    evaluator = getattr(request.app.state, "mission_evaluator", None)
    store = getattr(request.app.state, "mission_store", None)
    if not evaluator or not store:
        return ApiResponse(data={})
    mission = store.get(mission_id)
    if not mission:
        return ApiResponse(data={})
    return ApiResponse(data=evaluator.evaluate(mission.to_dict()))

@router.get("/missions/{mission_id}/summary", response_model=ApiResponse[dict], dependencies=[Depends(require_bearer_token)])
async def get_mission_summary(mission_id: str, request: Request):
    summarizer = getattr(request.app.state, "mission_summarizer", None)
    evaluator = getattr(request.app.state, "mission_evaluator", None)
    store = getattr(request.app.state, "mission_store", None)
    if not summarizer or not evaluator or not store:
        return ApiResponse(data={"summary": "Not available"})
    mission = store.get(mission_id)
    if not mission:
        return ApiResponse(data={"summary": "Mission not found"})
    evaluation = evaluator.evaluate(mission.to_dict())
    text = await summarizer.summarize(mission.to_dict(), evaluation)
    return ApiResponse(data={"summary": text})
