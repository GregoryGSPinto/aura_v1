import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.security import require_bearer_token
from app.models.common_models import ApiResponse
from app.models.project_models import OpenProjectRequest, ProjectListResponse, ProjectOpenResult

logger = logging.getLogger("aura")

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DiscoveredProject(BaseModel):
    name: str
    path: str
    language: Optional[str] = None
    branch: Optional[str] = None
    git_status: Optional[str] = None
    last_modified: Optional[str] = None
    size_mb: Optional[float] = None
    description: Optional[str] = None
    has_package_json: bool = False
    has_requirements_txt: bool = False


class DiscoverResponse(BaseModel):
    projects: List[DiscoveredProject]
    total: int
    root: str


class SetActiveProjectRequest(BaseModel):
    project: str


class ActiveProjectInfo(BaseModel):
    name: str
    path: str
    language: Optional[str] = None
    branch: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_language(project_path: str) -> Optional[str]:
    """Detect primary language by checking manifest files."""
    checks = [
        ("package.json", "javascript"),
        ("tsconfig.json", "typescript"),
        ("requirements.txt", "python"),
        ("pyproject.toml", "python"),
        ("setup.py", "python"),
        ("Cargo.toml", "rust"),
        ("go.mod", "go"),
        ("pom.xml", "java"),
        ("build.gradle", "java"),
        ("Gemfile", "ruby"),
        ("mix.exs", "elixir"),
        ("pubspec.yaml", "dart"),
        ("composer.json", "php"),
        ("Package.swift", "swift"),
    ]
    for filename, lang in checks:
        if os.path.isfile(os.path.join(project_path, filename)):
            return lang
    return None


async def _git_branch(project_path: str) -> Optional[str]:
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "branch", "--show-current",
            cwd=project_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        branch = stdout.decode().strip()
        return branch if branch else None
    except Exception:
        return None


async def _git_status(project_path: str) -> Optional[str]:
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "status", "--porcelain",
            cwd=project_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        lines = stdout.decode().strip().splitlines()
        if not lines or (len(lines) == 1 and lines[0] == ""):
            return "clean"
        return f"{len(lines)} changes"
    except Exception:
        return None


def _dir_size_mb(project_path: str, max_depth: int = 3) -> float:
    """Calculate directory size in MB, limiting walk depth to avoid slowness."""
    total = 0
    base_depth = project_path.rstrip(os.sep).count(os.sep)
    for dirpath, dirnames, filenames in os.walk(project_path):
        current_depth = dirpath.rstrip(os.sep).count(os.sep) - base_depth
        if current_depth >= max_depth:
            dirnames.clear()
            continue
        # Skip common heavy directories
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", ".venv", "venv", "target", "dist", "build")]
        for f in filenames:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
    return round(total / (1024 * 1024), 2)


def _get_description(project_path: str) -> Optional[str]:
    """Get project description from package.json or README.md."""
    pkg_json = os.path.join(project_path, "package.json")
    if os.path.isfile(pkg_json):
        try:
            with open(pkg_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                desc = data.get("description")
                if desc:
                    return str(desc)
        except Exception:
            pass

    for readme_name in ("README.md", "readme.md", "README.txt", "README"):
        readme_path = os.path.join(project_path, readme_name)
        if os.path.isfile(readme_path):
            try:
                with open(readme_path, "r", encoding="utf-8") as f:
                    first_line = ""
                    for line in f:
                        stripped = line.strip()
                        if stripped:
                            # Skip markdown heading markers
                            first_line = stripped.lstrip("# ").strip()
                            break
                    if first_line:
                        return first_line[:200]
            except Exception:
                pass

    return None


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=ApiResponse[ProjectListResponse], dependencies=[Depends(require_bearer_token)])
async def list_projects(request: Request):
    projects = request.app.state.project_service.list_projects()
    return ApiResponse(data=ProjectListResponse(projects=projects, total=len(projects)))


@router.post("/projects/open", response_model=ApiResponse[ProjectOpenResult], dependencies=[Depends(require_bearer_token)])
async def open_project(request_body: OpenProjectRequest, request: Request):
    result = request.app.state.project_service.open_project(request_body.name)
    return ApiResponse(data=result)


# ---------------------------------------------------------------------------
# New endpoints: discover, active project
# ---------------------------------------------------------------------------

@router.get("/projects/discover", response_model=ApiResponse[DiscoverResponse], dependencies=[Depends(require_bearer_token)])
async def discover_projects(request: Request):
    """Auto-discover projects in PROJECTS_ROOT (directories with .git)."""
    projects_root = str(Path(request.app.state.settings.default_projects_root).expanduser().resolve())

    if not os.path.isdir(projects_root):
        return ApiResponse(data=DiscoverResponse(projects=[], total=0, root=projects_root))

    discovered: List[DiscoveredProject] = []
    try:
        entries = sorted(os.listdir(projects_root))
    except OSError:
        return ApiResponse(data=DiscoverResponse(projects=[], total=0, root=projects_root))

    tasks = []
    valid_entries: List[str] = []

    for entry in entries:
        full_path = os.path.join(projects_root, entry)
        if not os.path.isdir(full_path):
            continue
        git_dir = os.path.join(full_path, ".git")
        if not os.path.isdir(git_dir):
            continue
        valid_entries.append(entry)
        tasks.append(_discover_single_project(entry, full_path))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for result in results:
        if isinstance(result, DiscoveredProject):
            discovered.append(result)

    return ApiResponse(data=DiscoverResponse(projects=discovered, total=len(discovered), root=projects_root))


async def _discover_single_project(name: str, full_path: str) -> DiscoveredProject:
    """Gather info for a single discovered project."""
    language = _detect_language(full_path)
    branch, git_st = await asyncio.gather(
        _git_branch(full_path),
        _git_status(full_path),
    )

    try:
        mtime = os.path.getmtime(full_path)
        last_modified = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
    except OSError:
        last_modified = None

    size_mb = _dir_size_mb(full_path)
    description = _get_description(full_path)
    has_package_json = os.path.isfile(os.path.join(full_path, "package.json"))
    has_requirements_txt = os.path.isfile(os.path.join(full_path, "requirements.txt"))

    return DiscoveredProject(
        name=name,
        path=full_path,
        language=language,
        branch=branch,
        git_status=git_st,
        last_modified=last_modified,
        size_mb=size_mb,
        description=description,
        has_package_json=has_package_json,
        has_requirements_txt=has_requirements_txt,
    )


@router.post("/projects/active", response_model=ApiResponse[ActiveProjectInfo], dependencies=[Depends(require_bearer_token)])
async def set_active_project(request_body: SetActiveProjectRequest, request: Request):
    """Set the active project by name. Discovers it in PROJECTS_ROOT."""
    projects_root = str(Path(request.app.state.settings.default_projects_root).expanduser().resolve())
    project_path = os.path.join(projects_root, request_body.project)

    if not os.path.isdir(project_path):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {request_body.project}")

    language = _detect_language(project_path)
    branch = await _git_branch(project_path)

    active = ActiveProjectInfo(
        name=request_body.project,
        path=project_path,
        language=language,
        branch=branch,
    )
    request.app.state.active_project = active.model_dump()

    logger.info("[Projects] Active project set to: %s (%s)", active.name, active.path)
    return ApiResponse(data=active)


@router.get("/projects/active", response_model=ApiResponse[Optional[ActiveProjectInfo]], dependencies=[Depends(require_bearer_token)])
async def get_active_project(request: Request):
    """Get the currently active project."""
    active = request.app.state.active_project
    if active is None:
        return ApiResponse(data=None)
    return ApiResponse(data=ActiveProjectInfo(**active))

