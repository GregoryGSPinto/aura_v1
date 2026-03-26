import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Request

from app.models.common_models import ApiResponse
from app.services.health import health_registry
from app.services.operation_log import operation_log

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /health — aggregated health of every service
# ---------------------------------------------------------------------------
@router.get("/health", response_model=ApiResponse[dict])
async def get_health(request: Request):
    """Return the health status of all backend services."""

    now = datetime.now(timezone.utc)
    started_at: datetime = request.app.state.started_at
    uptime_seconds = int((now - started_at).total_seconds())

    services = health_registry.get_all()
    overall = health_registry.get_overall_status()

    return ApiResponse(
        data={
            "status": overall,
            "timestamp": now.isoformat(),
            "uptime_seconds": uptime_seconds,
            "services": services,
        }
    )


# ---------------------------------------------------------------------------
# POST /health/doctor — comprehensive diagnostic
# ---------------------------------------------------------------------------
@router.post("/health/doctor", response_model=ApiResponse[dict])
async def run_doctor(request: Request):
    """Run a comprehensive diagnostic check and return a structured report."""

    settings = request.app.state.settings
    checks_passed: List[str] = []
    checks_failed: List[str] = []
    actions_taken: List[str] = []
    actions_pending: List[str] = []

    # 1. Force a fresh check_all()
    try:
        await health_registry.check_all()
        checks_passed.append("health_registry.check_all() succeeded")
        actions_taken.append("Forced fresh health check on all registered services")
    except Exception as exc:
        checks_failed.append(f"health_registry.check_all() failed: {exc}")
        actions_pending.append("Investigate health_registry check_all failure")

    # Log health check results
    for name, svc in health_registry.get_all().items():
        if svc["status"] in ("online",):
            checks_passed.append(f"{name}: {svc['status']}")
        elif svc["status"] == "not_configured":
            checks_passed.append(f"{name}: not_configured (ok)")
        else:
            checks_failed.append(f"{name}: {svc['status']} — {svc.get('last_error', 'unknown')}")
            if svc.get("action"):
                actions_pending.append(f"{name}: {svc['action']}")

    # 2. Validate environment variables
    if settings.ollama_url:
        checks_passed.append(f"OLLAMA_URL is set: {settings.ollama_url}")
    else:
        checks_failed.append("OLLAMA_URL is not set")
        actions_pending.append("Set OLLAMA_URL in .env or environment")

    if settings.model_name:
        checks_passed.append(f"AURA_MODEL is set: {settings.model_name}")
    else:
        checks_failed.append("AURA_MODEL is not set")
        actions_pending.append("Set AURA_MODEL in .env or environment")

    # 3. Validate projects root directory
    projects_root = Path(settings.default_projects_root).expanduser()
    if projects_root.is_dir():
        checks_passed.append(f"Projects root exists: {projects_root}")
        if os.access(str(projects_root), os.R_OK | os.W_OK):
            checks_passed.append("Projects root is readable and writable")
        else:
            checks_failed.append("Projects root has insufficient permissions")
            actions_pending.append(f"Fix permissions on {projects_root}")
    else:
        checks_failed.append(f"Projects root does not exist: {projects_root}")
        actions_pending.append(f"Create directory: mkdir -p {projects_root}")

    # 4. Self-check
    checks_passed.append("Port 8000: API is responding (self-check passed)")

    total = len(checks_passed) + len(checks_failed)
    overall = "healthy" if not checks_failed else ("degraded" if len(checks_failed) < total else "unhealthy")

    operation_log.add("action", "doctor", f"Diagnostic completed: {overall}", {
        "passed": len(checks_passed),
        "failed": len(checks_failed),
    })

    return ApiResponse(
        data={
            "status": overall,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_checks": total,
            "passed": len(checks_passed),
            "failed": len(checks_failed),
            "checks_passed": checks_passed,
            "checks_failed": checks_failed,
            "actions_taken": actions_taken,
            "actions_pending": actions_pending,
        }
    )


# ---------------------------------------------------------------------------
# GET /logs/recent — recent operation logs
# ---------------------------------------------------------------------------
@router.get("/logs/recent", response_model=ApiResponse[dict])
async def get_recent_logs(limit: int = 20):
    """Return recent operation logs from the operation_log singleton."""

    entries = operation_log.get_recent(limit=limit)

    return ApiResponse(
        data={
            "count": len(entries),
            "limit": limit,
            "logs": entries,
        }
    )
