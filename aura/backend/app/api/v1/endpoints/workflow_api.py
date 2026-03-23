"""
Workflow Automation API — CRUD + execution for custom workflows.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.security import require_bearer_token

router = APIRouter(prefix="/workflows", dependencies=[Depends(require_bearer_token)])


class WorkflowCreateBody(BaseModel):
    name: str
    description: str = ""
    trigger: dict
    actions: list


class WorkflowUpdateBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[dict] = None
    actions: Optional[list] = None
    enabled: Optional[bool] = None


@router.get("")
async def list_workflows(request: Request):
    engine = request.app.state.workflow_engine
    return {"success": True, "data": {"workflows": engine.list_workflows()}}


@router.post("")
async def create_workflow(body: WorkflowCreateBody, request: Request):
    engine = request.app.state.workflow_engine
    workflow = engine.create_workflow(body.name, body.description, body.trigger, body.actions)
    return {"success": True, "data": workflow}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, request: Request):
    engine = request.app.state.workflow_engine
    w = engine.get_workflow(workflow_id)
    if not w:
        return {"success": False, "error": "Workflow not found"}
    return {"success": True, "data": w}


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, body: WorkflowUpdateBody, request: Request):
    engine = request.app.state.workflow_engine
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    w = engine.update_workflow(workflow_id, updates)
    if not w:
        return {"success": False, "error": "Workflow not found"}
    return {"success": True, "data": w}


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, request: Request):
    engine = request.app.state.workflow_engine
    deleted = engine.delete_workflow(workflow_id)
    return {"success": True, "data": {"deleted": deleted}}


@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, request: Request):
    engine = request.app.state.workflow_engine
    result = await engine.execute_workflow(workflow_id)
    return {"success": result.get("success", False), "data": result}


@router.get("/{workflow_id}/history")
async def workflow_history(workflow_id: str, request: Request):
    engine = request.app.state.workflow_engine
    history = engine.get_history(workflow_id)
    return {"success": True, "data": {"executions": history}}
