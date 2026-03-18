"""Connector API Endpoints for Ecosystem Connectors.

Provides REST API for managing external service connections.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.connector_models import (
    ConnectorDefinitionListResponse,
    ConnectorInstance,
    ConnectorInstanceListResponse,
    ConnectorStatusOverview,
    ConnectorSyncLogListResponse,
    ConnectorTestResult,
    CreateConnectorRequest,
    PermissionGrantRequest,
    UpdateConnectorRequest,
)

router = APIRouter()


# Definitions

@router.get(
    "/connectors/definitions",
    response_model=ApiResponse[ConnectorDefinitionListResponse],
    dependencies=[Depends(require_bearer_token)],
)
async def list_definitions(request: Request):
    """List available connector definitions."""
    result = request.app.state.connector_service.list_definitions()
    return ApiResponse(data=result)


@router.get(
    "/connectors/definitions/{definition_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def get_definition(definition_id: str, request: Request):
    """Get a connector definition by ID."""
    definition = request.app.state.connector_service.get_definition(definition_id)
    if not definition:
        from app.core.exceptions import AuraError
        raise AuraError(
            "definition_not_found",
            f"Connector definition '{definition_id}' not found",
            status_code=404,
        )
    return ApiResponse(data=definition.model_dump())


# Instances

@router.get(
    "/connectors",
    response_model=ApiResponse[ConnectorInstanceListResponse],
    dependencies=[Depends(require_bearer_token)],
)
async def list_instances(request: Request):
    """List all connector instances."""
    result = request.app.state.connector_service.list_instances()
    return ApiResponse(data=result)


@router.post(
    "/connectors",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def create_instance(
    request_body: CreateConnectorRequest,
    request: Request,
):
    """Create a new connector instance."""
    result = request.app.state.connector_service.create_instance(request_body)
    return ApiResponse(data=result)


@router.get(
    "/connectors/{connector_id}",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def get_instance(connector_id: str, request: Request):
    """Get a connector instance by ID."""
    instance = request.app.state.connector_service.get_instance(connector_id)
    if not instance:
        from app.core.exceptions import AuraError
        raise AuraError(
            "instance_not_found",
            f"Connector instance '{connector_id}' not found",
            status_code=404,
        )
    return ApiResponse(data=instance)


@router.put(
    "/connectors/{connector_id}",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def update_instance(
    connector_id: str,
    request_body: UpdateConnectorRequest,
    request: Request,
):
    """Update a connector instance."""
    result = request.app.state.connector_service.update_instance(connector_id, request_body)
    return ApiResponse(data=result)


@router.delete(
    "/connectors/{connector_id}",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def delete_instance(connector_id: str, request: Request):
    """Delete a connector instance."""
    request.app.state.connector_service.delete_instance(connector_id)
    return ApiResponse(data={"deleted": True, "id": connector_id})


# Connection lifecycle

@router.post(
    "/connectors/{connector_id}/connect",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def connect_connector(connector_id: str, request: Request):
    """Connect a connector instance."""
    result = await request.app.state.connector_service.connect(connector_id)
    return ApiResponse(data=result)


@router.post(
    "/connectors/{connector_id}/disconnect",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def disconnect_connector(connector_id: str, request: Request):
    """Disconnect a connector instance."""
    result = await request.app.state.connector_service.disconnect(connector_id)
    return ApiResponse(data=result)


@router.post(
    "/connectors/{connector_id}/test",
    response_model=ApiResponse[ConnectorTestResult],
    dependencies=[Depends(require_bearer_token)],
)
async def test_connector(connector_id: str, request: Request):
    """Test a connector connection."""
    result = await request.app.state.connector_service.test_connection(connector_id)
    return ApiResponse(data=result)


@router.post(
    "/connectors/{connector_id}/sync",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def sync_connector(
    connector_id: str,
    request: Request,
    sync_type: str = "manual",
):
    """Trigger a sync for a connector instance."""
    result = await request.app.state.connector_service.sync(connector_id, sync_type)
    return ApiResponse(data=result.model_dump())


# Sync logs

@router.get(
    "/connectors/{connector_id}/logs",
    response_model=ApiResponse[ConnectorSyncLogListResponse],
    dependencies=[Depends(require_bearer_token)],
)
async def get_sync_logs(
    connector_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
):
    """Get sync logs for a connector instance."""
    result = request.app.state.connector_service.get_sync_logs(connector_id, limit)
    return ApiResponse(data=result)


# Permissions

@router.get(
    "/connectors/{connector_id}/permissions",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def get_permissions(connector_id: str, request: Request):
    """Get permissions for a connector instance."""
    result = request.app.state.connector_service.get_permissions(connector_id)
    return ApiResponse(data=[p.model_dump() for p in result])


@router.post(
    "/connectors/{connector_id}/permissions/{action}",
    response_model=ApiResponse[ConnectorInstance],
    dependencies=[Depends(require_bearer_token)],
)
async def update_permission(
    connector_id: str,
    action: str,
    request_body: PermissionGrantRequest,
    request: Request,
):
    """Grant or revoke a permission for a connector instance."""
    result = request.app.state.connector_service.update_permission(
        connector_id, action, request_body
    )
    return ApiResponse(data=result)


# Status overview

@router.get(
    "/connectors/status/overview",
    response_model=ApiResponse[ConnectorStatusOverview],
    dependencies=[Depends(require_bearer_token)],
)
async def get_status_overview(request: Request):
    """Get dashboard overview of connector status."""
    result = await request.app.state.connector_service.get_status_overview()
    return ApiResponse(data=result)


# Connector-specific operations

@router.get(
    "/connectors/{connector_id}/calendar/events",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def get_calendar_events(
    connector_id: str,
    request: Request,
    days: int = Query(30, ge=1, le=365),
):
    """Get calendar events (for calendar connectors)."""
    from app.aura_os.connectors.implementations.calendar_connector import CalendarConnector
    
    connector = request.app.state.connector_service._instances.get(connector_id)
    if not connector or not isinstance(connector, CalendarConnector):
        from app.core.exceptions import AuraError
        raise AuraError(
            "invalid_connector",
            "Connector is not a calendar connector or is not connected",
            status_code=400,
        )
    
    events = await connector.get_upcoming_events(days=days)
    return ApiResponse(data=events)


@router.post(
    "/connectors/{connector_id}/calendar/events",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def create_calendar_event(
    connector_id: str,
    request: Request,
    event_data: dict,
):
    """Create a calendar event (for calendar connectors)."""
    from datetime import datetime
    from app.aura_os.connectors.implementations.calendar_connector import CalendarConnector
    
    connector = request.app.state.connector_service._instances.get(connector_id)
    if not connector or not isinstance(connector, CalendarConnector):
        from app.core.exceptions import AuraError
        raise AuraError(
            "invalid_connector",
            "Connector is not a calendar connector or is not connected",
            status_code=400,
        )
    
    # Parse dates
    start_time = datetime.fromisoformat(event_data.get("start_time"))
    end_time = None
    if event_data.get("end_time"):
        end_time = datetime.fromisoformat(event_data["end_time"])
    
    event = await connector.create_event(
        title=event_data.get("title", "Untitled"),
        start_time=start_time,
        end_time=end_time,
        description=event_data.get("description", ""),
        location=event_data.get("location", ""),
    )
    
    return ApiResponse(data=event)


@router.get(
    "/connectors/{connector_id}/git/repositories",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def get_git_repositories(connector_id: str, request: Request):
    """Get git repositories (for git connectors)."""
    from app.aura_os.connectors.implementations.git_connector import GitConnector
    
    connector = request.app.state.connector_service._instances.get(connector_id)
    if not connector or not isinstance(connector, GitConnector):
        from app.core.exceptions import AuraError
        raise AuraError(
            "invalid_connector",
            "Connector is not a git connector or is not connected",
            status_code=400,
        )
    
    repos = await connector.get_repositories()
    return ApiResponse(data=repos)


@router.get(
    "/connectors/{connector_id}/filesystem/list",
    response_model=ApiResponse[list],
    dependencies=[Depends(require_bearer_token)],
)
async def list_filesystem(
    connector_id: str,
    request: Request,
    path: str = Query("."),
):
    """List filesystem contents (for filesystem connectors)."""
    from app.aura_os.connectors.implementations.filesystem_connector import FilesystemConnector
    
    connector = request.app.state.connector_service._instances.get(connector_id)
    if not connector or not isinstance(connector, FilesystemConnector):
        from app.core.exceptions import AuraError
        raise AuraError(
            "invalid_connector",
            "Connector is not a filesystem connector or is not connected",
            status_code=400,
        )
    
    items = await connector.list_directory(path)
    return ApiResponse(data=items)


@router.post(
    "/connectors/{connector_id}/vscode/open",
    response_model=ApiResponse[dict],
    dependencies=[Depends(require_bearer_token)],
)
async def open_in_vscode(
    connector_id: str,
    request: Request,
    project_path: str,
):
    """Open a project in VS Code: (for vscode connectors)."""
    from app.aura_os.connectors.implementations.vscode_connector import VSCode:Connector
    
    connector = request.app.state.connector_service._instances.get(connector_id)
    if not connector or not isinstance(connector, VSCode:Connector):
        from app.core.exceptions import AuraError
        raise AuraError(
            "invalid_connector",
            "Connector is not a VS Code: connector or is not connected",
            status_code=400,
        )
    
    result = await connector.open_project(project_path)
    return ApiResponse(data=result)
