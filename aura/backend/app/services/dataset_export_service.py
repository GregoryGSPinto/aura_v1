import json
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from app.prompts.aura_absolute import AURA_ABSOLUTE_PROMPT
from app.services.memory_service import MemoryService

logger = logging.getLogger("aura")

MIN_CONTENT_LENGTH = 10


class DatasetExportService:
    """
    Exporta conversas em formato pronto para fine-tuning.

    Formatos suportados:
    - JSONL (formato padrão para fine-tuning de LLMs)
    - Alpaca format (instruction/input/output)
    - ChatML format (messages array)
    """

    def __init__(self, memory_service: MemoryService):
        self.memory_service = memory_service

    def _group_by_session(self) -> Dict[str, List[Dict[str, Any]]]:
        messages = self.memory_service.get_chat_messages(limit=100_000)
        sessions: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for msg in messages:
            sid = msg.get("session_id", "unknown")
            sessions[sid].append(msg)
        return dict(sessions)

    def _is_valid_message(self, msg: Dict[str, Any]) -> bool:
        content = msg.get("content", "")
        return isinstance(content, str) and len(content.strip()) >= MIN_CONTENT_LENGTH

    def _build_conversation(self, messages: List[Dict[str, Any]], include_system: bool = True) -> Optional[List[Dict[str, str]]]:
        conversation: List[Dict[str, str]] = []
        if include_system:
            conversation.append({"role": "system", "content": AURA_ABSOLUTE_PROMPT})

        for msg in messages:
            if not self._is_valid_message(msg):
                continue
            role = msg.get("role", "user")
            if role not in {"user", "assistant", "system"}:
                continue
            conversation.append({"role": role, "content": msg["content"].strip()})

        user_msgs = [m for m in conversation if m["role"] == "user"]
        assistant_msgs = [m for m in conversation if m["role"] == "assistant"]
        if not user_msgs or not assistant_msgs:
            return None
        return conversation

    def _quality_score(self, messages: List[Dict[str, Any]]) -> float:
        if not messages:
            return 0.0
        score = 0.0
        valid = [m for m in messages if self._is_valid_message(m)]
        if not valid:
            return 0.0
        score += min(len(valid) / 4.0, 1.0) * 0.3
        has_intent = any(m.get("intent") for m in valid)
        has_model = any(m.get("model") for m in valid)
        has_metadata = any(m.get("metadata") for m in valid)
        if has_intent:
            score += 0.2
        if has_model:
            score += 0.2
        if has_metadata:
            score += 0.1
        avg_len = sum(len(m.get("content", "")) for m in valid) / len(valid)
        score += min(avg_len / 500.0, 1.0) * 0.2
        return round(min(score, 1.0), 3)

    async def export_jsonl(self, min_quality_score: float = 0.7) -> str:
        sessions = self._group_by_session()
        lines: List[str] = []
        for session_id, messages in sessions.items():
            if self._quality_score(messages) < min_quality_score:
                continue
            conversation = self._build_conversation(messages, include_system=True)
            if not conversation:
                continue
            entry = {"messages": conversation}
            lines.append(json.dumps(entry, ensure_ascii=False))
        logger.info("Dataset JSONL export: %d examples from %d sessions", len(lines), len(sessions))
        return "\n".join(lines)

    async def export_alpaca(self) -> str:
        sessions = self._group_by_session()
        lines: List[str] = []
        for session_id, messages in sessions.items():
            valid = [m for m in messages if self._is_valid_message(m)]
            user_msgs = [m for m in valid if m.get("role") == "user"]
            assistant_msgs = [m for m in valid if m.get("role") == "assistant"]
            if not user_msgs or not assistant_msgs:
                continue
            instruction = user_msgs[0]["content"].strip()
            context_parts = [m["content"].strip() for m in user_msgs[1:]]
            input_text = "\n".join(context_parts) if context_parts else ""
            output = "\n\n".join(m["content"].strip() for m in assistant_msgs)
            entry = {
                "instruction": instruction,
                "input": input_text,
                "output": output,
                "metadata": {
                    "session_id": session_id,
                    "model": assistant_msgs[0].get("model"),
                    "intent": assistant_msgs[0].get("intent"),
                },
            }
            lines.append(json.dumps(entry, ensure_ascii=False))
        logger.info("Dataset Alpaca export: %d examples from %d sessions", len(lines), len(sessions))
        return "\n".join(lines)

    async def export_chatml(self) -> str:
        sessions = self._group_by_session()
        lines: List[str] = []
        for session_id, messages in sessions.items():
            conversation = self._build_conversation(messages, include_system=True)
            if not conversation:
                continue
            entry = {
                "session_id": session_id,
                "messages": conversation,
                "metadata": {
                    "model": next((m.get("model") for m in messages if m.get("model")), None),
                    "intent": next((m.get("intent") for m in messages if m.get("intent")), None),
                },
            }
            lines.append(json.dumps(entry, ensure_ascii=False))
        logger.info("Dataset ChatML export: %d examples from %d sessions", len(lines), len(sessions))
        return "\n".join(lines)

    async def get_dataset_stats(self) -> dict:
        sessions = self._group_by_session()
        total_messages = sum(len(msgs) for msgs in sessions.values())
        intent_dist: Dict[str, int] = defaultdict(int)
        model_dist: Dict[str, int] = defaultdict(int)
        provider_dist: Dict[str, int] = defaultdict(int)
        quality_scores: List[float] = []

        for session_id, messages in sessions.items():
            quality_scores.append(self._quality_score(messages))
            for msg in messages:
                if msg.get("intent"):
                    intent_dist[msg["intent"]] += 1
                if msg.get("model"):
                    model_dist[msg["model"]] += 1
                meta = msg.get("metadata") or {}
                if meta.get("provider"):
                    provider_dist[meta["provider"]] += 1

        exportable = sum(1 for s in quality_scores if s >= 0.7)
        return {
            "total_sessions": len(sessions),
            "total_messages": total_messages,
            "exportable_sessions": exportable,
            "avg_quality_score": round(sum(quality_scores) / len(quality_scores), 3) if quality_scores else 0.0,
            "intent_distribution": dict(intent_dist),
            "model_distribution": dict(model_dist),
            "provider_distribution": dict(provider_dist),
        }
