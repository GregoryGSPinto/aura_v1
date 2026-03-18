"""Connector Service - CRUD and lifecycle management for ecosystem connectors.

This service manages connector instances, their lifecycle, and provides
audit trails for all connector actions.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.core.exceptions import AuraError
from app.models.connector_models import (
    ConnectorDefinition,
    ConnectorDefinitionListResponse,
    ConnectorHealth,
    ConnectorInstance,
    ConnectorInstanceListResponse,
    ConnectorPermission,
    ConnectorStatus,
    ConnectorStatusOverview,
    ConnectorSyncLog,
    ConnectorSyncLogListResponse,
    ConnectorTestResult,
    CreateConnectorRequest,
    PermissionGrantRequest,
    SyncResult,
    UpdateConnectorRequest,
)
from app.models.persistence_models import AuditLogEntry
from app.aura_os.connectors.base import BaseConnector, ConnectorContext
from app.aura_os.connectors.registry import ConnectorRegistry, get_registry
from app.services.memory_service import MemoryService
from app.services.persistence_service import PersistenceService
from app.utils.helpers import iso_now


class ConnectorService:
    """Service for managing ecosystem connectors."""
    
    def __init__(
        self,
        persistence_service: PersistenceService,
        memory_service: MemoryService,
        logger,
    ):
        self.persistence_service = persistence_service
        self.memory_service = memory_service
        self.logger = logger
        self.registry = get_registry()
        self._instances: Dict[str, BaseConnector] = {}
        self._sync_logs: List[ConnectorSyncLog] = []
        self._data_dir = Path(get_settings().projects_file).parent
        self._load_instances()
    
    # Persistence methods
    
    def _get_storage_path(self) -> Path:
        """Get the storage path for connector data."""
        return self._data_dir / "connectors.json"
    
    def _load_instances(self) -> None:
        """Load connector instances from storage."""
        path = self._get_storage_path()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                # Instances will be loaded on-demand
                self._sync_logs = [
                    ConnectorSyncLog(**log) for log in data.get("sync_logs", [])
                ]
            except (json.JSONDecodeError, IOError) as e:
                self.logger.warning(f"Failed to load connector data: {e}")
    
    def _save_instances(self, instances: List[ConnectorInstance]) -> None:
        """Save connector instances to storage."""
        path = self._get_storage_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "instances": [instance.model_dump() for instance in instances],
            "sync_logs": [log.model_dump() for log in self._sync_logs[-100:]],  # Keep last 100
            "updated_at": iso_now(),
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    
    def _load_instance_data(self) -> List[Dict[str, Any]]:
        """Load raw instance data from storage."""
        path = self._get_storage_path()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data.get("instances", [])
            except (json.JSONDecodeError, IOError):
                pass
        return []
    
    # Definition management
    
    def list_definitions(self) -> ConnectorDefinitionListResponse:
        """List all available connector definitions."""
        definitions = self.registry.list_definitions()
        return ConnectorDefinitionListResponse(
            definitions=definitions,
            total=len(definitions),
        )
    
    def get_definition(self, definition_id: str) -> Optional[ConnectorDefinition]:
        """Get a connector definition by ID."""
        return self.registry.get_definition(definition_id)
    
    # Instance CRUD
    
    def list_instances(self) -> ConnectorInstanceListResponse:
        """List all connector instances."""
        raw_data = self._load_instance_data()
        instances = [ConnectorInstance(**data) for data in raw_data]
        return ConnectorInstanceListResponse(
            connectors=instances,
            total=len(instances),
        )
    
    def get_instance(self, instance_id: str) -> Optional[ConnectorInstance]:
        """Get a connector instance by ID."""
        raw_data = self._load_instance_data()
        for data in raw_data:
            if data.get("id") == instance_id:
                return ConnectorInstance(**data)
        return None
    
    def create_instance(self, request: CreateConnectorRequest) -> ConnectorInstance:
        """Create a new connector instance."""
        # Validate definition exists
        definition = self.registry.get_definition(request.definition_id)
        if not definition:
            raise AuraError(
                "definition_not_found",
                f"Connector definition '{request.definition_id}' not found",
                status_code=404,
            )
        
        # Create instance
        instance = ConnectorInstance(
            id=str(uuid.uuid4()),
            definition_id=request.definition_id,
            name=request.name,
            settings=request.settings,
            permissions=self._get_default_permissions(definition),
        )
        
        # Save to storage
        raw_data = self._load_instance_data()
        raw_data.append(instance.model_dump())
        self._save_instances([ConnectorInstance(**d) for d in raw_data])
        
        # Log action
        self._log_action("connector_created", instance.id, {"name": instance.name})
        
        return instance
    
    def update_instance(
        self,
        instance_id: str,
        request: UpdateConnectorRequest,
    ) -> ConnectorInstance:
        """Update a connector instance."""
        raw_data = self._load_instance_data()
        
        for i, data in enumerate(raw_data):
            if data.get("id") == instance_id:
                # Update fields
                if request.name is not None:
                    data["name"] = request.name
                if request.settings is not None:
                    data["settings"] = request.settings
                if request.sync_enabled is not None:
                    data["sync_enabled"] = request.sync_enabled
                if request.sync_interval_minutes is not None:
                    data["sync_interval_minutes"] = request.sync_interval_minutes
                
                data["updated_at"] = iso_now()
                
                self._save_instances([ConnectorInstance(**d) for d in raw_data])
                
                # Log action
                self._log_action("connector_updated", instance_id, {})
                
                return ConnectorInstance(**data)
        
        raise AuraError(
            "instance_not_found",
            f"Connector instance '{instance_id}' not found",
            status_code=404,
        )
    
    def delete_instance(self, instance_id: str) -> bool:
        """Delete a connector instance."""
        raw_data = self._load_instance_data()
        
        for i, data in enumerate(raw_data):
            if data.get("id") == instance_id:
                # Disconnect if connected
                if instance_id in self._instances:
                    connector = self._instances[instance_id]
                    import asyncio
                    asyncio.create_task(connector.disconnect())
                    del self._instances[instance_id]
                
                del raw_data[i]
                self._save_instances([ConnectorInstance(**d) for d in raw_data])
                
                # Log action
                self._log_action("connector_deleted", instance_id, {})
                
                return True
        
        raise AuraError(
            "instance_not_found",
            f"Connector instance '{instance_id}' not found",
            status_code=404,
        )
    
    # Connection lifecycle
    
    async def connect(self, instance_id: str) -> ConnectorInstance:
        """Connect a connector instance."""
        instance = self.get_instance(instance_id)
        if not instance:
            raise AuraError(
                "instance_not_found",
                f"Connector instance '{instance_id}' not found",
                status_code=404,
            )
        
        definition = self.registry.get_definition(instance.definition_id)
        if not definition:
            raise AuraError(
                "definition_not_found",
                f"Connector definition '{instance.definition_id}' not found",
                status_code=404,
            )
        
        # Create context
        context = ConnectorContext(
            instance_id=instance.id,
            settings=instance.settings,
            credentials=instance.credentials,
            permissions=instance.permissions,
            data_dir=str(self._data_dir),
        )
        
        # Create and connect
        connector = self.registry.create_connector(instance.definition_id, context)
        if not connector:
            raise AuraError(
                "connector_creation_failed",
                f"Failed to create connector for '{instance.definition_id}'",
                status_code=500,
            )
        
        success = await connector.connect(instance.credentials)
        
        if success:
            self._instances[instance_id] = connector
            
            # Update instance status
            raw_data = self._load_instance_data()
            for data in raw_data:
                if data.get("id") == instance_id:
                    data["status"] = ConnectorStatus.CONNECTED.value
                    data["connected_at"] = iso_now()
                    data["error_message"] = None
                    break
            self._save_instances([ConnectorInstance(**d) for d in raw_data])
            
            self._log_action("connector_connected", instance_id, {})
        else:
            raise AuraError(
                "connection_failed",
                f"Failed to connect: {connector.last_error}",
                status_code=400,
            )
        
        return self.get_instance(instance_id)
    
    async def disconnect(self, instance_id: str) -> ConnectorInstance:
        """Disconnect a connector instance."""
        instance = self.get_instance(instance_id)
        if not instance:
            raise AuraError(
                "instance_not_found",
                f"Connector instance '{instance_id}' not found",
                status_code=404,
            )
        
        # Disconnect if we have a live instance
        if instance_id in self._instances:
            connector = self._instances[instance_id]
            await connector.disconnect()
            del self._instances[instance_id]
        
        # Update instance status
        raw_data = self._load_instance_data()
        for data in raw_data:
            if data.get("id") == instance_id:
                data["status"] = ConnectorStatus.DISCONNECTED.value
                data["connected_at"] = None
                break
        self._save_instances([ConnectorInstance(**d) for d in raw_data])
        
        self._log_action("connector_disconnected", instance_id, {})
        
        return self.get_instance(instance_id)
    
    async def test_connection(self, instance_id: str) -> ConnectorTestResult:
        """Test a connector connection."""
        instance = self.get_instance(instance_id)
        if not instance:
            raise AuraError(
                "instance_not_found",
                f"Connector instance '{instance_id}' not found",
                status_code=404,
            )
        
        # Get or create connector
        if instance_id in self._instances:
            connector = self._instances[instance_id]
        else:
            context = ConnectorContext(
                instance_id=instance.id,
                settings=instance.settings,
                credentials=instance.credentials,
                permissions=instance.permissions,
                data_dir=str(self._data_dir),
            )
            connector = self.registry.create_connector(instance.definition_id, context)
            if not connector:
                raise AuraError(
                    "connector_creation_failed",
                    f"Failed to create connector",
                    status_code=500,
                )
        
        result = await connector.test_connection()
        
        self._log_action("connector_tested", instance_id, {"success": result.success})
        
        return result
    
    async def sync(self, instance_id: str, sync_type: str = "manual") -> ConnectorSyncLog:
        """Trigger a sync for a connector instance."""
        instance = self.get_instance(instance_id)
        if not instance:
            raise AuraError(
                "instance_not_found",
                f"Connector instance '{instance_id}' not found",
                status_code=404,
            )
        
        # Ensure connected
        if instance.status != ConnectorStatus.CONNECTED:
            raise AuraError(
                "not_connected",
                "Connector must be connected before syncing",
                status_code=400,
            )
        
        connector = self._instances.get(instance_id)
        if not connector:
            raise AuraError(
                "connector_not_loaded",
                "Connector instance not loaded",
                status_code=500,
            )
        
        # Create sync log
        log = ConnectorSyncLog(
            id=str(uuid.uuid4()),
            connector_id=instance_id,
            status="pending",
            started_at=datetime.now(timezone.utc),
            sync_type=sync_type,
        )
        
        # Perform sync
        try:
            result: SyncResult = await connector.sync(sync_type)
            
            log.status = result.status.value
            log.completed_at = datetime.now(timezone.utc)
            log.records_synced = result.records_synced
            log.records_failed = result.records_failed
            log.error_details = result.error_details
            log.metadata = result.metadata
            
            # Update instance last_sync_at
            raw_data = self._load_instance_data()
            for data in raw_data:
                if data.get("id") == instance_id:
                    data["last_sync_at"] = iso_now()
                    break
            self._save_instances([ConnectorInstance(**d) for d in raw_data])
            
        except Exception as e:
            log.status = "failed"
            log.completed_at = datetime.now(timezone.utc)
            log.error_details = str(e)
        
        # Store log
        self._sync_logs.append(log)
        if len(self._sync_logs) > 1000:
            self._sync_logs = self._sync_logs[-500:]
        
        # Save
        instances = [ConnectorInstance(**d) for d in self._load_instance_data()]
        self._save_instances(instances)
        
        self._log_action("connector_synced", instance_id, {"status": log.status})
        
        return log
    
    # Permission management
    
    def get_permissions(self, instance_id: str) -> List[ConnectorPermission]:
        """Get permissions for a connector instance."""
        instance = self.get_instance(instance_id)
        if not instance:
            raise AuraError(
                "instance_not_found",
                f"Connector instance '{instance_id}' not found",
                status_code=404,
            )
        return instance.permissions
    
    def update_permission(
        self,
        instance_id: str,
        action: str,
        request: PermissionGrantRequest,
    ) -> ConnectorInstance:
        """Grant or revoke a permission."""
        raw_data = self._load_instance_data()
        
        for data in raw_data:
            if data.get("id") == instance_id:
                permissions = data.get("permissions", [])
                
                # Find and update permission
                found = False
                for perm in permissions:
                    if perm.get("action") == action:
                        perm["granted"] = request.granted
                        found = True
                        break
                
                if not found:
                    # Add new permission
                    permissions.append({
                        "action": action,
                        "resource": "*",  # Generic permission
                        "description": f"Permission to {action}",
                        "granted": request.granted,
                    })
                
                data["permissions"] = permissions
                data["updated_at"] = iso_now()
                
                self._save_instances([ConnectorInstance(**d) for d in raw_data])
                
                self._log_action(
                    "permission_updated",
                    instance_id,
                    {"action": action, "granted": request.granted},
                )
                
                return ConnectorInstance(**data)
        
        raise AuraError(
            "instance_not_found",
            f"Connector instance '{instance_id}' not found",
            status_code=404,
        )
    
    # Sync logs
    
    def get_sync_logs(
        self,
        instance_id: str,
        limit: int = 50,
    ) -> ConnectorSyncLogListResponse:
        """Get sync logs for a connector instance."""
        logs = [log for log in self._sync_logs if log.connector_id == instance_id]
        logs.sort(key=lambda x: x.started_at, reverse=True)
        
        return ConnectorSyncLogListResponse(
            logs=logs[:limit],
            total=len(logs),
        )
    
    # Status and health
    
    async def get_status_overview(self) -> ConnectorStatusOverview:
        """Get dashboard overview of connector status."""
        instances = self.list_instances().connectors
        
        # Calculate stats
        connected = sum(1 for i in instances if i.status == ConnectorStatus.CONNECTED)
        disconnected = sum(1 for i in instances if i.status == ConnectorStatus.DISCONNECTED)
        error = sum(1 for i in instances if i.status == ConnectorStatus.ERROR)
        connecting = sum(1 for i in instances if i.status == ConnectorStatus.CONNECTING)
        
        # Count recent syncs
        now = datetime.now(timezone.utc)
        day_ago = now - timezone.timedelta(days=1)
        recent_syncs = [log for log in self._sync_logs if log.started_at > day_ago]
        failed_recent = [log for log in recent_syncs if log.status == "failed"]
        
        # Health score
        total = len(instances)
        if total == 0:
            health_score = 1.0
        else:
            health_score = connected / total
        
        # Last sync
        last_sync = None
        if self._sync_logs:
            last_sync = max(log.completed_at for log in self._sync_logs if log.completed_at)
        
        return ConnectorStatusOverview(
            total_connectors=total,
            connected=connected,
            disconnected=disconnected,
            error=error,
            connecting=connecting,
            total_syncs_24h=len(recent_syncs),
            failed_syncs_24h=len(failed_recent),
            last_sync_at=last_sync,
            health_score=health_score,
        )
    
    def get_connected_count(self) -> int:
        """Get the number of connected connectors."""
        instances = self.list_instances().connectors
        return sum(1 for i in instances if i.status == ConnectorStatus.CONNECTED)
    
    # Helper methods
    
    def _get_default_permissions(
        self,
        definition: ConnectorDefinition,
    ) -> List[ConnectorPermission]:
        """Get default permissions for a connector type."""
        # Create permissions based on features
        permissions = []
        
        for feature in definition.features:
            action = feature.replace("_", ":")
            permissions.append(ConnectorPermission(
                action=action,
                resource="*",
                description=f"Allow {feature}",
                granted=True,  # Grant by default for local connectors
            ))
        
        return permissions
    
    def _log_action(self, action: str, instance_id: str, details: Dict[str, Any]) -> None:
        """Log a connector action to audit trail."""
        try:
            entry = AuditLogEntry(
                action=action,
                target_type="connector",
                target_id=instance_id,
                details=details,
            )
            self.persistence_service.record_audit_log(entry)
        except Exception as e:
            self.logger.warning(f"Failed to log connector action: {e}")
