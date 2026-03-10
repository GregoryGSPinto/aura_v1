from typing import Any, Dict, List

from app.services.memory_service import MemoryService


class LongTermMemory:
    def __init__(self, memory_service: MemoryService):
        self.memory_service = memory_service

    def save_preference(self, key: str, value: Any) -> Dict[str, Any]:
        settings = self.memory_service.get_settings()
        preferences = settings.get("user_preferences", {})
        preferences[key] = value
        return self.memory_service.update_settings({"user_preferences": preferences})

    def append_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        settings = self.memory_service.get_settings()
        tasks: List[Dict[str, Any]] = settings.get("long_term_tasks", [])
        tasks.append(task)
        return self.memory_service.update_settings({"long_term_tasks": tasks[-100:]})

    def snapshot(self) -> Dict[str, Any]:
        settings = self.memory_service.get_settings()
        return {
            "preferences": settings.get("user_preferences", {}),
            "tasks": settings.get("long_term_tasks", []),
        }
