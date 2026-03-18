"""Models for Ecosystem Connectors framework.

Conectores do Ecossistema - Framework for external integrations
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.common_models import utc_now


class ConnectorType(str, Enum):
    """Types of connectors available in the ecosystem."""
    CALENDAR = "calendar"
    EMAIL = "email"
    STORAGE = "storage"
    GIT = "git"
    COMMUNICATION = "communication"
    FILESYSTEM = "filesystem"
    DEVTOOLS = "devtools"


class AuthType(str, Enum):
    """Authentication types for connectors."""
    OAUTH = "oauth"
    API_KEY = "apikey"
    TOKEN = "token"
    BASIC = "basic"
    NONE = "none"


class ConnectorStatus(str, Enum):
    """Status of a connector instance."""
    CONNECTED = "connected"
    CONNECTING = "connecting"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class SyncStatus(str, Enum):
    """Status of a sync operation."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class ConnectorPermission(BaseModel):
    """Permission definition for a connector."""
    action: str = Field(..., description="Action identifier (e.g., 'read', 'write', 'delete')")
    resource: str = Field(..., description="Resource type (e.g., 'events', 'files', 'messages')")
    description: str = Field(..., description="Human-readable description of the permission")
    granted: bool = Field(default=False, description="Whether this permission is granted")


class ConfigSchemaProperty(BaseModel):
    """JSON Schema property for connector configuration."""
    type: str = Field(..., description="JSON Schema type (string, number, boolean, array, object)")
    title: Optional[str] = Field(None, description="Human-readable title")
    description: Optional[str] = Field(None, description="Description of the property")
    default: Optional[Any] = Field(None, description="Default value")
    enum: Optional[List[Any]] = Field(None, description="Enum values if applicable")
    required: bool = Field(False, description="Whether this property is required")


class ConnectorDefinition(BaseModel):
    """Definition of a connector type available in the ecosystem.
    
    This represents the "blueprint" for a connector that users can instantiate.
    """
    id: str = Field(..., description="Unique identifier for the connector definition")
    name: str = Field(..., description="Display name of the connector")
    type: ConnectorType = Field(..., description="Category of the connector")
    description: str = Field(..., description="Human-readable description")
    version: str = Field(default="1.0.0", description="Version of the connector definition")
    auth_type: AuthType = Field(..., description="Type of authentication required")
    scopes: List[str] = Field(default_factory=list, description="OAuth scopes or permission categories")
    config_schema: Dict[str, ConfigSchemaProperty] = Field(
        default_factory=dict,
        description="JSON Schema for connector configuration"
    )
    icon: Optional[str] = Field(None, description="Icon identifier or URL")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    features: List[str] = Field(default_factory=list, description="List of supported features")
    provider: Optional[str] = Field(None, description="Provider name (e.g., 'Google', 'Microsoft')")
    documentation_url: Optional[str] = Field(None, description="Link to documentation")


class ConnectorCredentials(BaseModel):
    """Encrypted credentials for a connector instance.
    
    Note: In production, the 'value' field should be encrypted at rest.
    """
    auth_type: AuthType
    encrypted_value: str = Field(..., description="Encrypted credential value")
    expires_at: Optional[datetime] = Field(None, description="Token expiration time if applicable")
    refresh_token: Optional[str] = Field(None, description="Refresh token for OAuth flows")


class ConnectorInstance(BaseModel):
    """An instantiated and configured connector.
    
    This represents a user's actual connection to an external service.
    """
    id: str = Field(..., description="Unique instance identifier")
    definition_id: str = Field(..., description="Reference to ConnectorDefinition")
    name: str = Field(..., description="User-given name for this connection")
    status: ConnectorStatus = Field(default=ConnectorStatus.DISCONNECTED)
    credentials: Optional[ConnectorCredentials] = Field(None, description="Encrypted credentials")
    settings: Dict[str, Any] = Field(default_factory=dict, description="Instance-specific settings")
    permissions: List[ConnectorPermission] = Field(default_factory=list, description="Granted permissions")
    connected_at: Optional[datetime] = Field(None, description="When the connection was established")
    last_sync_at: Optional[datetime] = Field(None, description="Last successful sync timestamp")
    error_message: Optional[str] = Field(None, description="Latest error message if status is error")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    sync_enabled: bool = Field(default=True, description="Whether auto-sync is enabled")
    sync_interval_minutes: int = Field(default=30, description="Auto-sync interval in minutes")


class ConnectorSyncLog(BaseModel):
    """Log entry for a sync operation."""
    id: str = Field(..., description="Unique log entry identifier")
    connector_id: str = Field(..., description="Reference to ConnectorInstance")
    status: SyncStatus = Field(..., description="Status of the sync operation")
    started_at: datetime = Field(..., description="When the sync started")
    completed_at: Optional[datetime] = Field(None, description="When the sync completed")
    records_synced: int = Field(default=0, description="Number of records synced")
    records_failed: int = Field(default=0, description="Number of records that failed to sync")
    error_details: Optional[str] = Field(None, description="Error details if sync failed")
    sync_type: str = Field(default="full", description="Type of sync: full, incremental, manual")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional sync metadata")


class ConnectorHealth(BaseModel):
    """Health status for a connector."""
    connector_id: str
    status: ConnectorStatus
    last_check_at: datetime = Field(default_factory=utc_now)
    response_time_ms: Optional[int] = None
    error_count_24h: int = 0
    sync_success_rate: float = 1.0
    message: Optional[str] = None


# Request/Response models for API

class CreateConnectorRequest(BaseModel):
    """Request to create a new connector instance."""
    definition_id: str
    name: str
    settings: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list, description="Permission actions to grant")


class UpdateConnectorRequest(BaseModel):
    """Request to update a connector instance."""
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None


class ConnectorTestResult(BaseModel):
    """Result of testing a connector connection."""
    success: bool
    message: str
    response_time_ms: Optional[int] = None
    details: Optional[Dict[str, Any]] = None


class ConnectorSyncResult(BaseModel):
    """Result of triggering a connector sync."""
    log_id: str
    status: SyncStatus
    message: str
    records_synced: int = 0


class ConnectorStatusOverview(BaseModel):
    """Dashboard overview of connector status."""
    total_connectors: int
    connected: int
    disconnected: int
    error: int
    connecting: int
    total_syncs_24h: int
    failed_syncs_24h: int
    last_sync_at: Optional[datetime] = None
    health_score: float = Field(..., ge=0, le=1, description="Overall health score 0-1")


class ConnectorDefinitionListResponse(BaseModel):
    """Response for listing connector definitions."""
    definitions: List[ConnectorDefinition]
    total: int


class ConnectorInstanceListResponse(BaseModel):
    """Response for listing connector instances."""
    connectors: List[ConnectorInstance]
    total: int


class ConnectorSyncLogListResponse(BaseModel):
    """Response for listing sync logs."""
    logs: List[ConnectorSyncLog]
    total: int


class PermissionGrantRequest(BaseModel):
    """Request to grant or revoke a permission."""
    granted: bool
