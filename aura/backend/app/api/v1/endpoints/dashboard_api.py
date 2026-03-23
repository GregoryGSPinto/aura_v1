"""
Dashboard API — Aggregated system data for the monitoring dashboard.
"""

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")
router = APIRouter(prefix="/dashboard", dependencies=[Depends(require_bearer_token)])


@router.get("")
async def get_dashboard(request: Request):
    settings = request.app.state.settings
    started_at = getattr(request.app.state, "started_at", None)
    uptime_s = (datetime.now(timezone.utc) - started_at).total_seconds() if started_at else 0

    # System metrics
    system = {"cpu_percent": 0, "ram_percent": 0, "ram_used_gb": 0, "ram_total_gb": 0,
              "disk_percent": 0, "disk_used_gb": 0, "disk_total_gb": 0, "uptime_hours": round(uptime_s / 3600, 1)}
    try:
        import psutil
        system["cpu_percent"] = psutil.cpu_percent(interval=0.5)
        ram = psutil.virtual_memory()
        system["ram_percent"] = ram.percent
        system["ram_used_gb"] = round(ram.used / (1024 ** 3), 1)
        system["ram_total_gb"] = round(ram.total / (1024 ** 3), 1)
        disk = psutil.disk_usage("/")
        system["disk_percent"] = disk.percent
        system["disk_used_gb"] = round(disk.used / (1024 ** 3), 0)
        system["disk_total_gb"] = round(disk.total / (1024 ** 3), 0)
    except ImportError:
        pass

    # Services
    services = {
        "backend": {"status": "online", "port": 8000, "uptime_ms": int(uptime_s * 1000)},
        "ollama": {"status": "unknown", "model": settings.model_name},
    }
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            if r.status_code == 200:
                services["ollama"]["status"] = "running"
    except Exception:
        services["ollama"]["status"] = "offline"

    # Token budget
    budget_service = getattr(request.app.state, "token_budget_service", None)
    token_budget = {
        "daily_used_usd": 0, "daily_limit_usd": settings.token_budget_daily_usd,
        "monthly_used_usd": 0, "monthly_limit_usd": settings.token_budget_monthly_usd,
        "tier": "green",
    }
    if budget_service:
        try:
            status = budget_service.get_status()
            token_budget["daily_used_usd"] = round(status.get("daily_used_usd", 0), 4)
            token_budget["monthly_used_usd"] = round(status.get("monthly_used_usd", 0), 4)
            token_budget["tier"] = status.get("tier", "green")
        except Exception:
            pass

    # Connectors
    connectors = {}
    for name, connector in [("github", request.app.state.github_connector),
                            ("gmail", request.app.state.gmail_connector),
                            ("calendar", request.app.state.calendar_connector)]:
        try:
            configured = await connector.is_configured() if connector else False
            connectors[name] = {"configured": configured}
        except Exception:
            connectors[name] = {"configured": False}

    # Recent activity from audit log
    recent_activity = []
    try:
        memory_service = request.app.state.memory_service
        audit = memory_service.get_audit_logs()
        for entry in audit[-10:]:
            recent_activity.append({
                "type": entry.get("action", "").split(":")[0],
                "summary": entry.get("action", ""),
                "time": entry.get("timestamp", ""),
            })
        recent_activity.reverse()
    except Exception:
        pass

    # Stats
    stats = {"total_chats": 0, "total_commands": 0, "uptime_days": round(uptime_s / 86400, 1)}
    try:
        messages = memory_service.get_chat_messages()
        stats["total_chats"] = len(messages)
    except Exception:
        pass

    return {"success": True, "data": {
        "system": system,
        "services": services,
        "token_budget": token_budget,
        "connectors": connectors,
        "recent_activity": recent_activity,
        "stats": stats,
    }}
