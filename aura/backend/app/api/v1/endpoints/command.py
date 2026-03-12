from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token
from app.core.security_policies import limit_command_requests
from app.models.command_models import CommandExecutionResult, CommandRequest
from app.models.common_models import ApiResponse


router = APIRouter()


@router.post(
    "/command",
    response_model=ApiResponse[CommandExecutionResult],
    dependencies=[Depends(require_bearer_token), Depends(limit_command_requests)],
)
async def execute_command(request_body: CommandRequest, request: Request):
    result = request.app.state.command_service.execute(
        request_body.command,
        request_body.params,
        actor={
            **getattr(request.state, "auth_context", {}),
            "request_id": getattr(request.state, "request_id", None),
        },
    )
    return ApiResponse(data=result)
