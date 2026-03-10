from typing import Any, Dict

from app.aura_os.memory.long_term import LongTermMemory
from app.aura_os.memory.short_term import ShortTermMemory
from app.aura_os.memory.vector_store import InMemoryVectorStore
from app.services.memory_service import MemoryService


class MemoryManager:
    def __init__(self, memory_service: MemoryService):
        self.short_term = ShortTermMemory()
        self.long_term = LongTermMemory(memory_service)
        self.vector_store = InMemoryVectorStore()

    def remember_interaction(self, goal: str, result: Dict[str, Any]) -> None:
        snapshot = {"goal": goal, "result": result}
        self.short_term.add(snapshot)
        self.vector_store.add(doc_id=f"interaction-{len(self.short_term.recent())}", text=goal, metadata=result)

    def remember_task(self, goal: str, status: str) -> None:
        self.long_term.append_task({"goal": goal, "status": status})

    def search(self, query: str) -> Dict[str, Any]:
        return {
            "short_term": self.short_term.recent()[-5:],
            "vector_matches": self.vector_store.search(query),
        }

    def overview(self) -> Dict[str, Any]:
        long_term = self.long_term.snapshot()
        return {
            "short_term": self.short_term.summary(),
            "long_term": {
                "preferences": len(long_term.get("preferences", {})),
                "tasks": len(long_term.get("tasks", [])),
            },
            "vector_store": self.vector_store.summary(),
        }
