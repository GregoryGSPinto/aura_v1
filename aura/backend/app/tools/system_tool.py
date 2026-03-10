import os
import platform
import shutil
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.core.config import Settings

try:
    import psutil  # type: ignore
except Exception:  # pragma: no cover
    psutil = None


class SystemTool:
    def __init__(self, settings: Settings):
        self.settings = settings

    def cpu(self) -> Dict[str, object]:
        if psutil:
            return {
                "usage_percent": psutil.cpu_percent(interval=0.15),
                "core_count": psutil.cpu_count(logical=True),
                "load_average": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
            }
        return {
            "usage_percent": round(os.getloadavg()[0] * 100 / max(os.cpu_count() or 1, 1), 2) if hasattr(os, "getloadavg") else 0.0,
            "core_count": os.cpu_count() or 1,
            "load_average": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
        }

    def memory(self) -> Dict[str, object]:
        if psutil:
            vm = psutil.virtual_memory()
            return {
                "usage_percent": vm.percent,
                "total": vm.total,
                "available": vm.available,
                "used": vm.used,
            }
        return {"usage_percent": 0.0, "total": 0, "available": 0, "used": 0}

    def disk(self, path: Optional[str] = None) -> Dict[str, object]:
        if psutil:
            usage = psutil.disk_usage(path or "/")
            return {
                "path": path or "/",
                "usage_percent": usage.percent,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
            }
        usage = shutil.disk_usage(path or "/")
        used = usage.total - usage.free
        usage_percent = round((used / usage.total) * 100, 2) if usage.total else 0.0
        return {"path": path or "/", "usage_percent": usage_percent, "total": usage.total, "used": used, "free": usage.free}

    def processes(self, limit: int = 15) -> List[Dict[str, object]]:
        if not psutil:
            return []
        processes: List[Dict[str, object]] = []
        for process in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            info = process.info
            cpu_value = info.get("cpu_percent", 0.0) or 0.0
            memory_value = info.get("memory_percent", 0.0) or 0.0
            processes.append(
                {
                    "pid": info.get("pid"),
                    "name": info.get("name"),
                    "cpu": round(cpu_value, 2),
                    "memory": round(memory_value, 2),
                }
            )
        return sorted(processes, key=lambda item: item["cpu"], reverse=True)[:limit]

    def summary(self, backend_status: str, llm_status: str, persistence_mode: str, auth_mode: str) -> Dict[str, object]:
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hostname": platform.node(),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "backend_status": backend_status,
            "llm_status": llm_status,
            "persistence_mode": persistence_mode,
            "auth_mode": auth_mode,
            "cpu": self.cpu(),
            "memory": self.memory(),
            "disk": self.disk(),
            "process_count": len(self.processes(limit=200)) if psutil else 0,
        }
