"""Git Connector - Git repository operations.

Provides programmatic access to git repositories for status,
history, and basic operations.
"""

import re
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


class GitConnector(BaseConnector):
    """Git repository connector.
    
    Features:
    - Repository status and information
    - Commit history
    - Branch management
    - Remote operations
    - Working tree status
    """
    
    definition_id = "git_connector"
    name = "Git Repositories"
    connector_type = ConnectorType.GIT
    description = "Connect to local git repositories for status, history, and operations"
    version = "1.0.0"
    auth_type = AuthType.NONE
    scopes: List[str] = []
    icon = "git-branch"
    features = [
        "repo_status",
        "commit_history",
        "branch_list",
        "remote_info",
        "working_tree_status",
        "stash_list",
        "tag_list",
    ]
    config_schema = {
        "repository_paths": ConfigSchemaProperty(
            type="array",
            title="Repository Paths",
            description="List of git repository paths to monitor",
            default=[],
        ),
        "auto_discover": ConfigSchemaProperty(
            type="boolean",
            title="Auto Discover",
            description="Automatically discover git repositories in allowed paths",
            default=True,
        ),
        "max_history_depth": ConfigSchemaProperty(
            type="number",
            title="Max History Depth",
            description="Maximum number of commits to fetch in history",
            default=50,
        ),
    }
    
    def __init__(self, context: ConnectorContext):
        super().__init__(context)
        self._repositories: List[Path] = []
        self._git_executable: Optional[str] = None
    
    def _find_git(self) -> Optional[str]:
        """Find the git executable."""
        import shutil
        return shutil.which("git")
    
    def _run_git(
        self,
        repo_path: Path,
        args: List[str],
        check: bool = True,
    ) -> subprocess.CompletedProcess:
        """Run a git command in a repository."""
        if not self._git_executable:
            raise RuntimeError("Git executable not found")
        
        cmd = [self._git_executable] + args
        return subprocess.run(
            cmd,
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=check,
        )
    
    def _load_repositories(self) -> None:
        """Load configured repositories."""
        paths = self.context.settings.get("repository_paths", [])
        self._repositories = [Path(p).expanduser().resolve() for p in paths if p]
        
        # Auto-discover if enabled
        if self.context.settings.get("auto_discover", True):
            self._discover_repositories()
    
    def _discover_repositories(self) -> None:
        """Discover git repositories in common locations."""
        data_dir = Path(self.context.data_dir).resolve()
        projects_dir = Path.home() / "Projects"
        
        search_paths = [data_dir, projects_dir]
        
        for base_path in search_paths:
            if not base_path.exists():
                continue
            
            try:
                for item in base_path.iterdir():
                    if item.is_dir() and (item / ".git").exists():
                        if item not in self._repositories:
                            self._repositories.append(item)
            except PermissionError:
                continue
    
    def _is_valid_repo(self, path: Path) -> bool:
        """Check if path is a valid git repository."""
        if not (path / ".git").exists():
            return False
        
        try:
            result = self._run_git(path, ["rev-parse", "--git-dir"], check=False)
            return result.returncode == 0
        except Exception:
            return False
    
    async def connect(self, credentials: Optional[ConnectorCredentials] = None) -> bool:
        """Initialize the git connector."""
        try:
            self._set_status(ConnectorStatus.CONNECTING)
            
            self._git_executable = self._find_git()
            if not self._git_executable:
                self._set_status(ConnectorStatus.ERROR, "Git executable not found in PATH")
                return False
            
            self._load_repositories()
            self._set_status(ConnectorStatus.CONNECTED)
            return True
        except Exception as e:
            self._set_status(ConnectorStatus.ERROR, str(e))
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from git."""
        self._set_status(ConnectorStatus.DISCONNECTED)
        return True
    
    async def test_connection(self) -> ConnectorTestResult:
        """Test git availability and repository access."""
        if not self._git_executable:
            return ConnectorTestResult(
                success=False,
                message="Git executable not found",
            )
        
        try:
            # Test git version
            result = subprocess.run(
                [self._git_executable, "--version"],
                capture_output=True,
                text=True,
                check=True,
            )
            version = result.stdout.strip()
            
            # Count valid repos
            valid_repos = [r for r in self._repositories if self._is_valid_repo(r)]
            
            return ConnectorTestResult(
                success=True,
                message=f"Git available: {version}. {len(valid_repos)} repositories configured.",
                details={
                    "git_version": version,
                    "total_repos": len(self._repositories),
                    "valid_repos": len(valid_repos),
                    "repositories": [str(r) for r in valid_repos],
                },
            )
        except Exception as e:
            return ConnectorTestResult(
                success=False,
                message=f"Git test failed: {str(e)}",
            )
    
    async def sync(self, sync_type: str = "incremental") -> SyncResult:
        """Sync repository information."""
        self.validate_permissions("read", "repository")
        
        repo_count = 0
        failed_count = 0
        
        for repo_path in self._repositories:
            if self._is_valid_repo(repo_path):
                repo_count += 1
            else:
                failed_count += 1
        
        return SyncResult(
            status=SyncStatus.SUCCESS if failed_count == 0 else SyncStatus.PARTIAL,
            records_synced=repo_count,
            records_failed=failed_count,
            metadata={"repositories": [str(r) for r in self._repositories]},
        )
    
    # Git-specific methods
    
    async def get_repositories(self) -> List[Dict[str, Any]]:
        """Get list of configured repositories with basic info."""
        self.validate_permissions("read", "repository")
        
        repos = []
        for path in self._repositories:
            if self._is_valid_repo(path):
                try:
                    info = await self.get_repository_info(path)
                    repos.append(info)
                except Exception as e:
                    repos.append({
                        "path": str(path),
                        "name": path.name,
                        "valid": False,
                        "error": str(e),
                    })
        
        return repos
    
    async def get_repository_info(self, repo_path: Optional[Path] = None) -> Dict[str, Any]:
        """Get detailed information about a repository."""
        self.validate_permissions("read", "repository")
        
        if repo_path is None:
            repo_path = self._repositories[0] if self._repositories else None
        
        if not repo_path:
            raise ValueError("No repository specified or configured")
        
        if not self._is_valid_repo(repo_path):
            raise ValueError(f"Not a valid git repository: {repo_path}")
        
        # Get current branch
        branch_result = self._run_git(repo_path, ["branch", "--show-current"], check=False)
        current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "unknown"
        
        # Get remote URL
        remote_result = self._run_git(repo_path, ["remote", "get-url", "origin"], check=False)
        remote_url = remote_result.stdout.strip() if remote_result.returncode == 0 else None
        
        # Get last commit
        log_result = self._run_git(
            repo_path,
            ["log", "-1", "--format=%H|%an|%ae|%ad|%s", "--date=iso"],
            check=False,
        )
        last_commit = None
        if log_result.returncode == 0:
            parts = log_result.stdout.strip().split("|", 4)
            if len(parts) == 5:
                last_commit = {
                    "hash": parts[0][:8],
                    "full_hash": parts[0],
                    "author": parts[1],
                    "email": parts[2],
                    "date": parts[3],
                    "message": parts[4],
                }
        
        # Get working tree status
        status_result = self._run_git(repo_path, ["status", "--porcelain"], check=False)
        has_changes = bool(status_result.stdout.strip())
        
        # Count uncommitted changes
        modified = status_result.stdout.count("M")
        added = status_result.stdout.count("A")
        deleted = status_result.stdout.count("D")
        untracked = status_result.stdout.count("??")
        
        return {
            "path": str(repo_path),
            "name": repo_path.name,
            "valid": True,
            "current_branch": current_branch,
            "remote_url": remote_url,
            "last_commit": last_commit,
            "has_changes": has_changes,
            "working_tree": {
                "modified": modified,
                "added": added,
                "deleted": deleted,
                "untracked": untracked,
            },
        }
    
    async def get_commit_history(
        self,
        repo_path: Optional[Path] = None,
        limit: Optional[int] = None,
        branch: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get commit history for a repository."""
        self.validate_permissions("read", "repository")
        
        if repo_path is None:
            repo_path = self._repositories[0] if self._repositories else None
        
        if not repo_path or not self._is_valid_repo(repo_path):
            raise ValueError("No valid repository specified")
        
        max_depth = limit or self.context.settings.get("max_history_depth", 50)
        
        branch_arg = branch or "HEAD"
        format_str = "%H|%an|%ae|%ad|%s"
        
        result = self._run_git(
            repo_path,
            ["log", branch_arg, f"-n{max_depth}", f"--format={format_str}", "--date=iso"],
            check=False,
        )
        
        commits = []
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if "|" not in line:
                    continue
                parts = line.split("|", 4)
                if len(parts) == 5:
                    commits.append({
                        "hash": parts[0][:8],
                        "full_hash": parts[0],
                        "author": parts[1],
                        "email": parts[2],
                        "date": parts[3],
                        "message": parts[4],
                    })
        
        return commits
    
    async def get_branches(self, repo_path: Optional[Path] = None) -> Dict[str, Any]:
        """Get branch information for a repository."""
        self.validate_permissions("read", "repository")
        
        if repo_path is None:
            repo_path = self._repositories[0] if self._repositories else None
        
        if not repo_path or not self._is_valid_repo(repo_path):
            raise ValueError("No valid repository specified")
        
        # Get local branches
        local_result = self._run_git(
            repo_path,
            ["branch", "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso)"],
            check=False,
        )
        
        # Get current branch
        current_result = self._run_git(repo_path, ["branch", "--show-current"], check=False)
        current = current_result.stdout.strip() if current_result.returncode == 0 else None
        
        local_branches = []
        if local_result.returncode == 0:
            for line in local_result.stdout.strip().split("\n"):
                if "|" not in line:
                    continue
                parts = line.split("|")
                if len(parts) == 3:
                    local_branches.append({
                        "name": parts[0],
                        "hash": parts[1],
                        "date": parts[2],
                        "current": parts[0] == current,
                    })
        
        # Get remote branches
        remote_result = self._run_git(
            repo_path,
            ["branch", "-r", "--format=%(refname:short)"],
            check=False,
        )
        
        remote_branches = []
        if remote_result.returncode == 0:
            remote_branches = [b.strip() for b in remote_result.stdout.strip().split("\n") if b.strip()]
        
        return {
            "current": current,
            "local": local_branches,
            "remote": remote_branches,
        }
    
    async def get_status(self, repo_path: Optional[Path] = None) -> Dict[str, Any]:
        """Get working tree status for a repository."""
        self.validate_permissions("read", "repository")
        
        if repo_path is None:
            repo_path = self._repositories[0] if self._repositories else None
        
        if not repo_path or not self._is_valid_repo(repo_path):
            raise ValueError("No valid repository specified")
        
        result = self._run_git(repo_path, ["status", "--porcelain", "-b"], check=False)
        
        staged = []
        unstaged = []
        untracked = []
        branch_info = None
        
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if line.startswith("##"):
                    # Branch info
                    branch_info = line[3:].strip()
                elif line.startswith("??"):
                    untracked.append(line[3:])
                elif line[:2].strip():
                    staged.append({"status": line[:2], "file": line[3:]})
                elif line[2:].strip():
                    unstaged.append({"status": line[2:].strip(), "file": line[3:]})
        
        return {
            "branch": branch_info,
            "staged": staged,
            "unstaged": unstaged,
            "untracked": untracked,
            "clean": not (staged or unstaged or untracked),
        }
