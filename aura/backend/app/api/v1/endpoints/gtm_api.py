"""
GTM Strategy API — CRUD + Insights endpoints.

Collections: leads, scripts, content, daily_metrics, tasks,
             activity, outreach_vars, script_usage, capture_goals
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import Any, Dict, Optional

from app.models.common_models import ApiResponse
from app.services.gtm_service import VALID_COLLECTIONS

router = APIRouter(prefix="/gtm", tags=["GTM Strategy"])


def _get_service(request: Request):
    svc = getattr(request.app.state, "gtm_service", None)
    if svc is None:
        raise HTTPException(503, "GTM Service not initialized")
    return svc


# ── Health ──────────────────────────────────────────────────

@router.get("/health", response_model=ApiResponse[dict])
async def gtm_health(request: Request):
    """Health check for the GTM module."""
    svc = _get_service(request)
    pipeline = svc.get_pipeline_stats()
    return ApiResponse(data={
        "status": "ok",
        "module": "gtm-strategy",
        "leads_count": pipeline["total"],
    })


# ── Insights (must come before {collection} catch-all) ─────

@router.get("/insights/pipeline", response_model=ApiResponse[dict])
async def pipeline_insights(request: Request):
    """Pipeline stats: totals by column, conversion rate, stale leads."""
    svc = _get_service(request)
    stats = svc.get_pipeline_stats()
    stale = svc.get_stale_leads(3)
    return ApiResponse(data={**stats, "stale_leads": len(stale)})


@router.get("/insights/metrics", response_model=ApiResponse[dict])
async def metrics_insights(request: Request):
    """Metrics summary: 7d, 30d, streak, goals vs actual."""
    svc = _get_service(request)
    return ApiResponse(data={
        "last_7d": svc.get_metrics_summary(7),
        "last_30d": svc.get_metrics_summary(30),
        "streak": svc.get_streak(),
    })


@router.get("/insights/briefing", response_model=ApiResponse[dict])
async def daily_briefing(request: Request):
    """Aggregated daily briefing for the Overview dashboard."""
    svc = _get_service(request)
    return ApiResponse(data=svc.get_daily_briefing())


# ── Generic CRUD ────────────────────────────────────────────

@router.get("/{collection}", response_model=ApiResponse[list])
async def list_items(
    collection: str,
    request: Request,
    product: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    column: Optional[str] = Query(None),
):
    """List all items in a collection, with optional filters."""
    if collection not in VALID_COLLECTIONS:
        raise HTTPException(400, f"Invalid collection: {collection}. Valid: {sorted(VALID_COLLECTIONS)}")
    svc = _get_service(request)
    filters: Dict[str, str] = {}
    if product:
        filters["product"] = product
    if status:
        filters["status"] = status
    if column:
        filters["column"] = column
    items = svc.list_items(collection, filters if filters else None)
    return ApiResponse(data=items)


@router.get("/{collection}/{item_id}", response_model=ApiResponse[dict])
async def get_item(collection: str, item_id: str, request: Request):
    """Get a single item by ID."""
    if collection not in VALID_COLLECTIONS:
        raise HTTPException(400, f"Invalid collection: {collection}")
    svc = _get_service(request)
    item = svc.get_item(collection, item_id)
    if item is None:
        raise HTTPException(404, f"Item {item_id} not found in {collection}")
    return ApiResponse(data=item)


@router.post("/{collection}", response_model=ApiResponse[dict])
async def create_item(collection: str, body: Dict[str, Any], request: Request):
    """Create or upsert an item."""
    if collection not in VALID_COLLECTIONS:
        raise HTTPException(400, f"Invalid collection: {collection}")
    svc = _get_service(request)
    item = svc.create_item(collection, body)
    return ApiResponse(data=item)


@router.put("/{collection}/{item_id}", response_model=ApiResponse[dict])
async def update_item(
    collection: str, item_id: str, body: Dict[str, Any], request: Request
):
    """Update an existing item."""
    if collection not in VALID_COLLECTIONS:
        raise HTTPException(400, f"Invalid collection: {collection}")
    svc = _get_service(request)
    item = svc.update_item(collection, item_id, body)
    if item is None:
        raise HTTPException(404, f"Item {item_id} not found in {collection}")
    return ApiResponse(data=item)


@router.delete("/{collection}/{item_id}", response_model=ApiResponse[dict])
async def delete_item(collection: str, item_id: str, request: Request):
    """Delete an item."""
    if collection not in VALID_COLLECTIONS:
        raise HTTPException(400, f"Invalid collection: {collection}")
    svc = _get_service(request)
    deleted = svc.delete_item(collection, item_id)
    if not deleted:
        raise HTTPException(404, f"Item {item_id} not found in {collection}")
    return ApiResponse(data={"deleted": True, "id": item_id})
