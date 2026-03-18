"""Base connector class and lifecycle management.

Provides the abstract interface that all connectors must implement.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.connector_models import (
    ConnectorCredentials,
    ConnectorHealth,
    ConnectorPermission,
    ConnectorStatus,
    ConnectorSyncLog,
    ConnectorTestResult,
    SyncStatus,
)


@dataclass
class ConnectorContext:
    """Context passed to connectors during operations."""
    instance_id: str
    settings: Dict[str, Any]
    credentials: Optional[ConnectorCredentials]
    permissions: List[ConnectorPermission]
    data_dir: str
    
    def has_permission(self, action: str, resource: str) -> bool:
        """Check if a specific permission is granted."""
        for perm in self.permissions:
            if perm.action == action and perm.resource == resource:
                return perm.granted
        return False


class SyncResult:
    """Result of a sync operation."""
    def __init__(
        self,
        status: SyncStatus,
        records_synced: int = 0,
        records_failed: int = 0,
        error_details: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.status = status
        self.records_synced = records_synced
        self.records_failed = records_failed
        self.error_details = error_details
        self.metadata = metadata or {}
        self.completed_at = datetime.utcnow()


class BaseConnector(ABC):
    """Abstract base class for all ecosystem connectors.
    
    All connectors must implement this interface to be registered
    and used within the Aura ecosystem.
    """
    
    def __init__(self, context: ConnectorContext):
        self.context = context
        self._status = ConnectorStatus.DISCONNECTED
        self._last_error: Optional[str] = None
    
    @property
    @abstractmethod
    def definition_id(self) -> str:
        """Return the unique identifier for this connector definition."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the display name of this connector."""
        pass
    
    @property
    def status(self) -> ConnectorStatus:
        """Return the current connection status."""
        return self._status
    
    @property
    def last_error(self) -> Optional[str]:
        """Return the last error message if any."""
        return self._last_error
    
    @abstractmethod
    async def connect(self, credentials: ConnectorCredentials) -> bool:
        """Establish connection to the external service.
        
        Args:
            credentials: The credentials to use for authentication
            
        Returns:
            True if connection was successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """Disconnect from the external service.
        
        Returns:
            True if disconnection was successful
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> ConnectorTestResult:
        """Test the connection without performing a full sync.
        
        Returns:
            ConnectorTestResult with success status and details
        """
        pass
    
    @abstractmethod
    async def sync(self, sync_type: str = "incremental") -> SyncResult:
        """Synchronize data with the external service.
        
        Args:
            sync_type: Type of sync - "full", "incremental", or "manual"
            
        Returns:
            SyncResult with details of the sync operation
        """
        pass
    
    def get_status(self) -> Dict[str, Any]:
        """Get detailed status information.
        
        Returns:
            Dictionary with status details
        """
        return {
            "definition_id": self.definition_id,
            "instance_id": self.context.instance_id,
            "status": self._status.value,
            "last_error": self._last_error,
            "permissions_granted": len([p for p in self.context.permissions if p.granted]),
            "permissions_total": len(self.context.permissions),
        }
    
    async def health_check(self) -> ConnectorHealth:
        """Perform a health check on the connector.
        
        Returns:
            ConnectorHealth with health status
        """
        import time
        start = time.time()
        
        try:
            test_result = await self.test_connection()
            response_time = int((time.time() - start) * 1000)
            
            return ConnectorHealth(
                connector_id=self.context.instance_id,
                status=self._status,
                response_time_ms=response_time,
                message=test_result.message if not test_result.success else None,
            )
        except Exception as e:
            return ConnectorHealth(
                connector_id=self.context.instance_id,
                status=ConnectorStatus.ERROR,
                error_count_24h=1,
                message=str(e),
            )
    
    def _set_status(self, status: ConnectorStatus, error: Optional[str] = None):
        """Update the connector status (internal use)."""
        self._status = status
        if error:
            self._last_error = error
        elif status == ConnectorStatus.CONNECTED:
            self._last_error = None
    
    def validate_permissions(self, action: str, resource: str) -> bool:
        """Validate that the connector has the required permission.
        
        Args:
            action: The action to check (e.g., "read", "write")
            resource: The resource type (e.g., "events", "files")
            
        Returns:
            True if permission is granted
            
        Raises:
            PermissionError: If permission is not granted
        """
        if not self.context.has_permission(action, resource):
            raise PermissionError(
                f"Permission denied: {action} on {resource}. "
                f"Grant this permission to use this feature."
            )
        return True
    
    async def on_created(self):
        """Lifecycle hook called when connector instance is created.
        
        Override to perform initialization that requires async.
        """
        pass
    
    async def on_deleted(self):
        """Lifecycle hook called when connector instance is deleted.
        
        Override to perform cleanup.
        """
        await self.disconnect()
