"""
Knowledge Extractor — Extrai fatos de cada conversa.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("aura")


class KnowledgeExtractor:

    def __init__(self, memory_service, ollama_service=None, budget_service=None):
        self.memory = memory_service
        self.ollama = ollama_service
        self.budget = budget_service

    async def extract_and_save(self, user_message: str, assistant_response: str, session_id: str):
        facts = self._extract_rules(user_message)
        for fact in facts:
            self._save_fact(fact, session_id)
        if facts:
            logger.info("[KnowledgeExtractor] Extracted %d facts from session %s", len(facts), session_id)
        return facts

    def _extract_rules(self, message: str) -> list:
        facts = []
        msg = message.lower()

        all_patterns = [
            (r'(?:prefiro|gosto mais de|uso|escolho)\s+(.+?)\s+(?:do que|ao invés|em vez)', 'preference'),
            (r'(?:meu favorito|minha favorita)\s+(?:é|eh)\s+(.+)', 'preference'),
            (r'(?:trabalho|trampo)\s+(?:na|no|em|como)\s+(.+?)(?:\.|,|$)', 'fact'),
            (r'(?:moro|vivo)\s+(?:em|na|no)\s+(.+?)(?:\.|,|$)', 'fact'),
            (r'(?:tenho|possuo)\s+(\d+)\s+(?:anos|filhos|gatos|cachorros)', 'fact'),
            (r'(?:projeto|app|sistema)\s+(\w+)\s+(?:está|tá|ta)\s+(.+?)(?:\.|,|$)', 'project'),
            (r'(?:quero|preciso|planejo|vou)\s+(.+?)(?:\.|,|$)', 'goal'),
            (r'(?:meu objetivo|minha meta)\s+(?:é|eh)\s+(.+?)(?:\.|,|$)', 'goal'),
            (r'(?:não quero|nao quero|para de|nunca)\s+(.+?)(?:\.|,|$)', 'boundary'),
        ]

        for pattern, category in all_patterns:
            matches = re.findall(pattern, msg)
            for match in matches:
                value = match if isinstance(match, str) else " ".join(match)
                value = value.strip()
                if len(value) >= 3:
                    facts.append({"category": category, "value": value, "confidence": 0.7, "source": "rule_extraction"})

        return facts

    def _save_fact(self, fact: dict, session_id: str):
        try:
            self.memory.remember_companion_item(
                bucket="operational_memory",
                item={
                    "title": f"[{fact['category']}] {fact['value']}",
                    "content": fact["value"],
                    "confidence": fact.get("confidence", 0.7),
                    "source": session_id,
                    "dedupe_key": f"{fact['category']}:{fact['value'][:50]}",
                },
            )
        except Exception as exc:
            logger.warning("[KnowledgeExtractor] Failed to save fact: %s", exc)
