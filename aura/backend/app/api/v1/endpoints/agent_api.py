"""
Agent API — Endpoints para o Agent Service.

Expoe as capacidades do agente para o frontend:
- Chat com tool calling
- Tarefas em background
- Aprovacoes L2
- Status de tools
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import json
import uuid

from app.core.security import require_bearer_token

router = APIRouter(prefix="/agent", dependencies=[Depends(require_bearer_token)])


class AgentChatRequest(BaseModel):
    message: str
    mode: str = "auto"  # auto, interactive, background
    conversation_history: Optional[List[dict]] = None


class ApprovalRequest(BaseModel):
    approval_id: str
    approved: bool


@router.post("/chat")
async def agent_chat(request: Request, body: AgentChatRequest, background_tasks: BackgroundTasks):
    """Chat com capacidade de tool calling."""
    agent = request.app.state.agent_service

    if body.mode == "background":
        task_id = str(uuid.uuid4())
        background_tasks.add_task(
            agent.process_background, body.message, task_id
        )
        return {"task_id": task_id, "status": "started", "message": "Tarefa iniciada em background"}

    # Auto ou interactive
    result = await agent.process_message(
        message=body.message,
        conversation_history=body.conversation_history,
        mode="interactive",
    )
    return result


@router.get("/tools")
async def list_tools(request: Request):
    """Lista todas as tools disponiveis."""
    registry = request.app.state.agent_tool_registry
    return {"tools": registry.list_tools()}


@router.get("/approvals")
async def get_approvals(request: Request):
    """Lista acoes L2 pendentes de aprovacao."""
    registry = request.app.state.agent_tool_registry
    return {"pending": registry.get_pending_approvals()}


@router.post("/approvals")
async def handle_approval(request: Request, body: ApprovalRequest):
    """Aprova ou rejeita uma acao L2."""
    registry = request.app.state.agent_tool_registry

    if body.approved:
        result = await registry.approve(body.approval_id)
        if result:
            return {"status": "approved", "result": result.to_dict()}
        return {"status": "error", "message": "Aprovacao nao encontrada"}
    else:
        rejected = registry.reject(body.approval_id)
        return {"status": "rejected" if rejected else "error"}


@router.get("/tasks/{task_id}")
async def get_task_status(request: Request, task_id: str):
    """Status de tarefa em background."""
    agent = request.app.state.agent_service
    status = agent.get_task_status(task_id)
    if not status:
        return {"status": "not_found"}
    return status


@router.get("/audit")
async def get_audit_log(request: Request, limit: int = 50):
    """Ultimas entradas do audit log."""
    log_path = "data/logs/tool_audit.jsonl"
    try:
        with open(log_path, "r") as f:
            lines = f.readlines()
        entries = [json.loads(line) for line in lines[-limit:]]
        entries.reverse()
        return {"entries": entries}
    except FileNotFoundError:
        return {"entries": []}
