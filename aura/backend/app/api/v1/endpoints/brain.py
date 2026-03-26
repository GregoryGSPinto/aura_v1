"""
Brain Router status endpoint.

GET /api/v1/brain/status — returns brain router status, usage, and budget.
"""

from fastapi import APIRouter, Request

from app.models.common_models import ApiResponse

router = APIRouter()


@router.get("/brain/status", response_model=ApiResponse[dict])
async def brain_status(request: Request):
    """Return brain router status including local/cloud availability and usage stats."""
    brain_router = getattr(request.app.state, "brain_router", None)
    claude_client = getattr(request.app.state, "claude_client", None)

    if not brain_router:
        return ApiResponse(
            data={
                "local": {"status": "online", "model": "qwen3.5:9b"},
                "cloud": {"status": "not_configured"},
                "usage_today": {"local": 0, "cloud": 0},
                "budget_remaining_cents": 0,
                "routing_stats": {},
            }
        )

    status = brain_router.get_status()

    # Enrich cloud status with model info from claude_client
    if claude_client and claude_client.available:
        status["cloud"]["model"] = claude_client.model
        status["cloud"]["status"] = "online"

    return ApiResponse(data=status)
