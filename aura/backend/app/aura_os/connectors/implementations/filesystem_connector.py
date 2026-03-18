"""Local Filesystem Connector - Safe file system access.

Provides controlled access to the local filesystem with allowlist-based
security and path validation.
"""

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.connector_models import (
    AuthType,
    ConfigSchemaProperty,
    ConnectorCredentials,
    ConnectorStatus,
    ConnectorTestResult,
    ConnectorType,
    SyncStatus,
)
from app.aura_os.connectors.base import BaseConnector, ConnectorContext, SyncResult


class FilesystemConnector(BaseConnector):
    """Local filesystem connector with security controls.
    
    Features:
    - Allowlist-based path access
    - Read file contents
    - List directories
    - File metadata
    - Safe path validation
    """
    
    definition_id = "local_filesystem"
    name = "Local Filesystem"
    connector_type = ConnectorType.FILESYSTEM
    description = "Safe access to local filesystem with allowlist-based security"
    version = "1.0.0"
    auth_type = AuthType.NONE
    scopes: List[str] = []
    icon = "folder"
    features = [
        "read_files",
        "list_directories",
        "file_metadata",
        "path_validation",
        "allowlist_security",
    ]
    config_schema = {
        "allowed_paths": ConfigSchemaProperty(
            type="array",
            title="Allowed Paths",
            description="List of allowed directory paths",
            default=[],
        ),
        "max_file_size": ConfigSchemaProperty(
            type="number",
            title="Max File Size",
            description="Maximum file size to read in bytes",
            default=1048576,  # 1MB
        ),
        "allow_hidden": ConfigSchemaProperty(
            type="boolean",
            title="Allow Hidden Files",
            description="Allow access to hidden files (starting with .)",
            default=False,
        ),
    }
    
    def __init__(self, context: ConnectorContext):
        super().__init__(context)
        self._allowed_paths: List[Path] = []
    
    def _load_allowed_paths(self) -> None:
        """Load allowed paths from settings."""
        paths = self.context.settings.get("allowed_paths", [])
        self._allowed_paths = [Path(p).expanduser().resolve() for p in paths if p]
        
        # Always allow the data directory
        data_dir = Path(self.context.data_dir).resolve()
        if data_dir not in self._allowed_paths:
            self._allowed_paths.append(data_dir)
    
    def _is_path_allowed(self, path: Path) -> bool:
        """Check if a path is within allowed directories."""
        try:
            resolved = path.expanduser().resolve()
            
            # Check for path traversal attacks
            for allowed in self._allowed_paths:
                try:
                    resolved.relative_to(allowed)
                    return True
                except ValueError:
                    continue
            
            return False
        except (OSError, ValueError):
            return False
    
    def _validate_file_access(self, path: Path) -> Path:
        """Validate and return resolved path or raise error."""
        resolved = path.expanduser().resolve()
        
        if not self._is_path_allowed(resolved):
            raise PermissionError(f"Access denied: {path} is not in allowed paths")
        
        # Check hidden files
        if not self.context.settings.get("allow_hidden", False):
            if any(part.startswith(".") for part in resolved.parts):
                raise PermissionError(f"Access denied: hidden files not allowed")
        
        return resolved
    
    async def connect(self, credentials: Optional[ConnectorCredentials] = None) -> bool:
        """Initialize the filesystem connector."""
        try:
            self._set_status(ConnectorStatus.CONNECTING)
            self._load_allowed_paths()
            
            if not self._allowed_paths:
                self._set_status(ConnectorStatus.ERROR, "No allowed paths configured")
                return False
            
            self._set_status(ConnectorStatus.CONNECTED)
            return True
        except Exception as e:
            self._set_status(ConnectorStatus.ERROR, str(e))
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from filesystem."""
        self._set_status(ConnectorStatus.DISCONNECTED)
        return True
    
    async def test_connection(self) -> ConnectorTestResult:
        """Test that allowed paths are accessible."""
        try:
            errors = []
            accessible_paths = []
            
            for path in self._allowed_paths:
                if path.exists() and path.is_dir():
                    accessible_paths.append(str(path))
                else:
                    errors.append(f"Path not accessible: {path}")
            
            if errors and not accessible_paths:
                return ConnectorTestResult(
                    success=False,
                    message="No allowed paths are accessible",
                    details={"errors": errors},
                )
            
            return ConnectorTestResult(
                success=True,
                message=f"Filesystem connector ready with {len(accessible_paths)} accessible paths",
                details={
                    "accessible_paths": accessible_paths,
                    "errors": errors if errors else None,
                },
            )
        except Exception as e:
            return ConnectorTestResult(
                success=False,
                message=f"Filesystem test failed: {str(e)}",
            )
    
    async def sync(self, sync_type: str = "incremental") -> SyncResult:
        """Sync is a no-op for filesystem connector."""
        return SyncResult(
            status=SyncStatus.SUCCESS,
            records_synced=0,
            metadata={"message": "Filesystem connector - sync not applicable"},
        )
    
    # Filesystem-specific methods
    
    async def list_directory(
        self,
        path: str,
        recursive: bool = False,
    ) -> List[Dict[str, Any]]:
        """List contents of a directory."""
        self.validate_permissions("read", "files")
        
        target = self._validate_file_access(Path(path))
        
        if not target.exists():
            raise FileNotFoundError(f"Directory not found: {path}")
        
        if not target.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {path}")
        
        items = []
        
        try:
            if recursive:
                for item in target.rglob("*"):
                    items.append(self._get_file_info(item))
            else:
                for item in target.iterdir():
                    items.append(self._get_file_info(item))
        except PermissionError as e:
            raise PermissionError(f"Cannot access directory: {e}")
        
        return items
    
    async def read_file(self, path: str) -> Dict[str, Any]:
        """Read contents of a file."""
        self.validate_permissions("read", "files")
        
        target = self._validate_file_access(Path(path))
        
        if not target.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        if target.is_dir():
            raise IsADirectoryError(f"Path is a directory: {path}")
        
        # Check file size
        max_size = self.context.settings.get("max_file_size", 1048576)
        if target.stat().st_size > max_size:
            raise ValueError(f"File too large: {target.stat().st_size} bytes (max: {max_size})")
        
        content = target.read_text(encoding="utf-8", errors="replace")
        
        return {
            "path": str(target),
            "content": content,
            "size": target.stat().st_size,
            "modified": datetime.fromtimestamp(target.stat().st_mtime).isoformat(),
        }
    
    async def get_file_info(self, path: str) -> Dict[str, Any]:
        """Get metadata about a file or directory."""
        self.validate_permissions("read", "files")
        
        target = self._validate_file_access(Path(path))
        
        if not target.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        
        return self._get_file_info(target)
    
    async def search_files(
        self,
        pattern: str,
        root_path: Optional[str] = None,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """Search for files by pattern."""
        self.validate_permissions("read", "files")
        
        if root_path:
            root = self._validate_file_access(Path(root_path))
        else:
            root = self._allowed_paths[0] if self._allowed_paths else Path.cwd()
        
        results = []
        
        try:
            for item in root.rglob(pattern):
                if self._is_path_allowed(item):
                    results.append(self._get_file_info(item))
                    if len(results) >= max_results:
                        break
        except PermissionError:
            pass
        
        return results
    
    def _get_file_info(self, path: Path) -> Dict[str, Any]:
        """Get file/directory information."""
        stat = path.stat()
        
        return {
            "name": path.name,
            "path": str(path),
            "type": "directory" if path.is_dir() else "file",
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "extension": path.suffix if path.is_file() else None,
        }
    
    async def get_allowed_paths(self) -> List[str]:
        """Get list of allowed paths."""
        return [str(p) for p in self._allowed_paths]
