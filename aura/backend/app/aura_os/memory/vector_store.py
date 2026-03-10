from typing import Any, Dict, List


class InMemoryVectorStore:
    def __init__(self):
        self._documents: List[Dict[str, Any]] = []

    def add(self, doc_id: str, text: str, metadata: Dict[str, Any]) -> None:
        self._documents.append({"id": doc_id, "text": text, "metadata": metadata})

    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        query_terms = set(term for term in query.lower().split() if term)
        scored: List[Dict[str, Any]] = []
        for document in self._documents:
            tokens = set(document["text"].lower().split())
            score = len(tokens.intersection(query_terms))
            if score > 0:
                scored.append({"score": score, **document})
        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:limit]

    def summary(self) -> Dict[str, Any]:
        return {
            "backend": "in_memory",
            "documents": len(self._documents),
            "production_target": "chroma_or_pgvector",
        }
