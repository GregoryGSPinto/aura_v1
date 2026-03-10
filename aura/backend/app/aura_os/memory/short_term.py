from collections import deque
from typing import Any, Deque, Dict, List


class ShortTermMemory:
    def __init__(self, limit: int = 30):
        self.limit = limit
        self._items: Deque[Dict[str, Any]] = deque(maxlen=limit)

    def add(self, item: Dict[str, Any]) -> None:
        self._items.append(item)

    def recent(self) -> List[Dict[str, Any]]:
        return list(self._items)

    def summary(self) -> Dict[str, Any]:
        return {
            "items": len(self._items),
            "limit": self.limit,
        }
