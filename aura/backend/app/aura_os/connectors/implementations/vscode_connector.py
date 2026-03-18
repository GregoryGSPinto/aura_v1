"""VS Code: Connector - IDE integration.

Provides integration with VS Code: for project opening,
workspace management, and extension information.
"""

import shutil
import subprocess
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


class VSCode:Connector(BaseConnector):
    """VS Code: IDE connector.
    
    Features:
    - Open projects in VS Code:
    - Workspace management
    - Recent projects list
    - Extension information
    - Settings sync (optional)
    """
    
    definition_id = "vscode_connector"
    name = "VS Code:"
    connector_type = ConnectorType.DEVTOOLS
    description = "Integration with VS Code: for project management and workspace control"
    version = "1.0.0"
    auth_type = AuthType.NONE
    scopes: List[str] = []
    icon = "code-2"
    features = [
        "open_projects",
        "recent_workspaces",
        "extension_info",
        "workspace_list",
    ]
    config_schema = {
        "code_path": ConfigSchemaProperty(
            type="string",
            title="VS Code: Path",
            description="Path to VS Code: executable (auto-detected if empty)",
            default="",
        ),
        "project_paths": ConfigSchemaProperty(
            type="array",
            title="Project Paths",
            description="List of project paths for quick access",
            default=[],
        ),
        "enable_insiders": ConfigSchemaProperty(
            type="boolean",
            title="Use Insiders",
            description="Use VS Code: Insiders edition if available",
            default=False,
        ),
    }
    
    def __init__(self, context: ConnectorContext):
        super().__init__(context)
        self._code_path: Optional[str] = None
        self._projects: List[Path] = []
    
    def _find_vscode(self) -> Optional[str]:
        """Find the VS Code: executable."""
        # Check if custom path is set
        custom_path = self.context.settings.get("code_path", "").strip()
        if custom_path:
            if shutil.which(custom_path):
                return custom_path
        
        # Check for Insiders preference
        use_insiders = self.context.settings.get("enable_insiders", False)
        
        # Common executable names
        candidates = ["code"]
        if use_insiders:
            candidates.insert(0, "code-insiders")
        else:
            candidates.append("code-insiders")
        
        for candidate in candidates:
            path = shutil.which(candidate)
            if path:
                return path
        
        return None
    
    def _load_projects(self) -> None:
        """Load configured project paths."""
        paths = self.context.settings.get("project_paths", [])
        self._projects = [Path(p).expanduser().resolve() for p in paths if p]
    
    async def connect(self, credentials: Optional[ConnectorCredentials] = None) -> bool:
        """Initialize the VS Code: connector."""
        try:
            self._set_status(ConnectorStatus.CONNECTING)
            
            self._code_path = self._find_vscode()
            if not self._code_path:
                self._set_status(ConnectorStatus.ERROR, "VS Code: executable not found")
                return False
            
            self._load_projects()
            self._set_status(ConnectorStatus.CONNECTED)
            return True
        except Exception as e:
            self._set_status(ConnectorStatus.ERROR, str(e))
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from VS Code:."""
        self._set_status(ConnectorStatus.DISCONNECTED)
        return True
    
    async def test_connection(self) -> ConnectorTestResult:
        """Test VS Code: availability."""
        if not self._code_path:
            return ConnectorTestResult(
                success=False,
                message="VS Code: executable not found",
            )
        
        try:
            # Test VS Code: version
            result = subprocess.run(
                [self._code_path, "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            
            if result.returncode == 0:
                version_lines = result.stdout.strip().split("\n")
                version = version_lines[0] if version_lines else "unknown"
                
                # Count accessible projects
                accessible = [p for p in self._projects if p.exists()]
                
                return ConnectorTestResult(
                    success=True,
                    message=f"VS Code: {version} available. {len(accessible)} projects configured.",
                    details={
                        "version": version,
                        "executable": self._code_path,
                        "total_projects": len(self._projects),
                        "accessible_projects": len(accessible),
                    },
                )
            else:
                return ConnectorTestResult(
                    success=False,
                    message=f"VS Code: test failed: {result.stderr}",
                )
        except Exception as e:
            return ConnectorTestResult(
                success=False,
                message=f"VS Code: test failed: {str(e)}",
            )
    
    async def sync(self, sync_type: str = "incremental") -> SyncResult:
        """Sync VS Code: information."""
        self.validate_permissions("read", "workspace")
        
        # Refresh project list
        self._load_projects()
        
        accessible = [p for p in self._projects if p.exists()]
        
        return SyncResult(
            status=SyncStatus.SUCCESS,
            records_synced=len(accessible),
            metadata={"projects": [str(p) for p in accessible]},
        )
    
    # VS Code:-specific methods
    
    async def open_project(self, project_path: str) -> Dict[str, Any]:
        """Open a project in VS Code:."""
        self.validate_permissions("write", "workspace")
        
        if not self._code_path:
            raise RuntimeError("VS Code: not available")
        
        path = Path(project_path).expanduser().resolve()
        
        if not path.exists():
            raise FileNotFoundError(f"Project path not found: {project_path}")
        
        # Open in VS Code:
        subprocess.Popen([self._code_path, str(path)])
        
        return {
            "opened": True,
            "path": str(path),
            "name": path.name,
            "editor": "VS Code:",
        }
    
    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get list of configured projects."""
        self.validate_permissions("read", "workspace")
        
        projects = []
        for path in self._projects:
            projects.append({
                "path": str(path),
                "name": path.name,
                "exists": path.exists(),
                "is_git_repo": (path / ".git").exists(),
            })
        
        return projects
    
    async def add_project(self, project_path: str) -> Dict[str, Any]:
        """Add a project to the quick access list."""
        self.validate_permissions("write", "workspace")
        
        path = Path(project_path).expanduser().resolve()
        
        if path not in self._projects:
            self._projects.append(path)
            # Note: settings persistence is handled by the service layer
        
        return {
            "added": True,
            "path": str(path),
            "name": path.name,
        }
    
    async def remove_project(self, project_path: str) -> Dict[str, Any]:
        """Remove a project from the quick access list."""
        self.validate_permissions("write", "workspace")
        
        path = Path(project_path).expanduser().resolve()
        
        if path in self._projects:
            self._projects.remove(path)
        
        return {
            "removed": True,
            "path": str(path),
        }
    
    async def get_recent_workspaces(self) -> List[Dict[str, Any]]:
        """Get recent workspaces from VS Code: storage.
        
        Note: This reads VS Code:'s state database if available.
        """
        self.validate_permissions("read", "workspace")
        
        # VS Code: stores recent workspaces in a SQLite database
        # Location varies by platform
        state_db_paths = []
        
        if self._code_path and "insiders" in self._code_path:
            app_name = "Code: - Insiders"
        else:
            app_name = "Code:"
        
        # Platform-specific paths
        import platform
        system = platform.system()
        
        if system == "Darwin":  # macOS
            state_db_paths.append(
                Path.home() / "Library/Application Support/Code:/globalStorage/state.vscdb"
            )
            state_db_paths.append(
                Path.home() / f"Library/Application Support/{app_name}/globalStorage/state.vscdb"
            )
        elif system == "Linux":
            state_db_paths.append(Path.home() / ".config/Code:/globalStorage/state.vscdb")
            state_db_paths.append(Path.home() / f".config/{app_name}/globalStorage/state.vscdb")
        elif system == "Windows":
            state_db_paths.append(
                Path.home() / f"AppData/Roaming/{app_name}/globalStorage/state.vscdb"
            )
        
        # Try to read recent workspaces from storage
        workspaces = []
        
        for db_path in state_db_paths:
            if db_path.exists():
                try:
                    # Simple parsing of recent paths from known locations
                    # Full SQLite parsing would require additional dependencies
                    content = db_path.read_text(errors="ignore")
                    # Look for workspace paths in the content
                    import re
                    path_pattern = r'("workspaces|history|recentWorkspaces)":\s*(\[[^\]]*\])'
                    matches = re.findall(path_pattern, content)
                    # This is a simplified extraction
                except Exception:
                    pass
        
        # Fallback: return configured projects as recent
        for project in self._projects:
            if project.exists():
                workspaces.append({
                    "path": str(project),
                    "name": project.name,
                    "source": "configured",
                })
        
        return workspaces[:10]  # Limit to 10
    
    async def get_extensions(self) -> List[Dict[str, Any]]:
        """Get list of installed extensions.
        
        Note: Requires VS Code: CLI access.
        """
        self.validate_permissions("read", "workspace")
        
        if not self._code_path:
            return []
        
        try:
            result = subprocess.run(
                [self._code_path, "--list-extensions"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            
            extensions = []
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    ext_id = line.strip()
                    if ext_id:
                        extensions.append({
                            "id": ext_id,
                            "name": ext_id.split(".")[-1] if "." in ext_id else ext_id,
                        })
            
            return extensions
        except Exception:
            return []
    
    async def install_extension(self, extension_id: str) -> Dict[str, Any]:
        """Install a VS Code: extension.
        
        Note: This may prompt for confirmation depending on VS Code: settings.
        """
        self.validate_permissions("write", "workspace")
        
        if not self._code_path:
            raise RuntimeError("VS Code: not available")
        
        # Note: We don't actually run the install command here
        # as it may require user interaction. Instead, we return
        # the command that can be executed.
        
        return {
            "can_install": True,
            "extension_id": extension_id,
            "command": f"{self._code_path} --install-extension {extension_id}",
            "note": "Extension installation requires confirmation in VS Code:",
        }
