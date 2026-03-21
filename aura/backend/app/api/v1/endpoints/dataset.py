from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.services.dataset_export_service import DatasetExportService

router = APIRouter(prefix="/dataset", tags=["dataset"])


def _get_export_service(request: Request) -> DatasetExportService:
    return DatasetExportService(request.app.state.memory_service)


@router.get(
    "/export",
    dependencies=[Depends(require_bearer_token)],
    response_class=PlainTextResponse,
)
async def export_dataset(
    request: Request,
    format: str = Query("jsonl", description="Export format: jsonl, alpaca, chatml"),
    min_quality: float = Query(0.7, ge=0.0, le=1.0, description="Minimum quality score filter (JSONL only)"),
):
    service = _get_export_service(request)
    if format == "alpaca":
        content = await service.export_alpaca()
    elif format == "chatml":
        content = await service.export_chatml()
    else:
        content = await service.export_jsonl(min_quality_score=min_quality)
    return PlainTextResponse(content=content, media_type="application/jsonl")


@router.get(
    "/stats",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def dataset_stats(request: Request):
    service = _get_export_service(request)
    stats = await service.get_dataset_stats()
    return ApiResponse(data=stats)
