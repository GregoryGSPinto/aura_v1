"""
Knowledge Extractor — Extrai fatos de cada conversa.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("aura")


class KnowledgeExtractor:

    def __init__(self, memory_service, ollama_service=None, budget_service=None, sqlite_memory=None):
        self.memory = memory_service
        self.ollama = ollama_service
        self.budget = budget_service
        self.sqlite_memory = sqlite_memory

    async def extract_and_save(self, user_message: str, assistant_response: str, session_id: str):
        facts = self._extract_rules(user_message)
        for fact in facts:
            self._save_fact(fact, session_id)
            self._save_to_sqlite(fact, session_id)
        if facts:
            logger.info("[KnowledgeExtractor] Extracted %d facts from session %s", len(facts), session_id)
        return facts

    def _extract_rules(self, message: str) -> list:
        facts = []
        msg = message.lower().strip()

        # ── Explicit memory commands (highest confidence) ──
        explicit_patterns = [
            (r'(?:lembra que|lembra disso|salva que|anota que|guarda que)\s+(.+?)(?:\.|!|$)', 'learning', 0.95),
            (r'(?:esquece que|esquece isso|apaga que|remove que)\s+(.+?)(?:\.|!|$)', 'forget', 0.95),
        ]

        # ── Preference patterns ──
        preference_patterns = [
            (r'(?:prefiro|gosto mais de|uso|escolho)\s+(.+?)\s+(?:do que|ao invés|em vez)', 'preference', 0.8),
            (r'(?:prefiro|gosto de|uso|quero usar)\s+(.+?)(?:\.|,|!|$)', 'preference', 0.7),
            (r'(?:meu favorito|minha favorita)\s+(?:é|eh)\s+(.+?)(?:\.|,|$)', 'preference', 0.8),
            (r'(?:sempre uso|costumo usar|minha stack|meu setup)\s+(.+?)(?:\.|,|$)', 'preference', 0.7),
        ]

        # ── Project patterns ──
        project_patterns = [
            (r'(?:o projeto|projeto)\s+(\w+)\s+(?:é|usa|tem|está|tá|ta)\s+(.+?)(?:\.|,|$)', 'project', 0.75),
            (r'(?:no projeto|pro projeto|do projeto)\s+(\w+)\s*,?\s+(.+?)(?:\.|,|$)', 'project', 0.7),
        ]

        # ── Personal fact patterns ──
        fact_patterns = [
            (r'(?:trabalho|trampo)\s+(?:na|no|em|como)\s+(.+?)(?:\.|,|$)', 'fact', 0.8),
            (r'(?:moro|vivo)\s+(?:em|na|no)\s+(.+?)(?:\.|,|$)', 'fact', 0.8),
            (r'(?:tenho|possuo)\s+(\d+)\s+(?:anos|filhos|gatos|cachorros)', 'fact', 0.8),
            (r'(?:meu nome|me chamo)\s+(?:é|eh)?\s*(.+?)(?:\.|,|$)', 'fact', 0.9),
            (r'(?:sou|eu sou)\s+(.+?)(?:\.|,|$)', 'fact', 0.6),
        ]

        # ── Goal patterns ──
        goal_patterns = [
            (r'(?:quero|preciso|planejo|vou)\s+(.+?)(?:\.|,|$)', 'goal', 0.6),
            (r'(?:meu objetivo|minha meta)\s+(?:é|eh)\s+(.+?)(?:\.|,|$)', 'goal', 0.7),
        ]

        # ── Boundary patterns ──
        boundary_patterns = [
            (r'(?:não quero|nao quero|para de|nunca)\s+(.+?)(?:\.|,|$)', 'boundary', 0.7),
        ]

        all_patterns = explicit_patterns + preference_patterns + project_patterns + fact_patterns + goal_patterns + boundary_patterns

        for pattern, category, confidence in all_patterns:
            matches = re.findall(pattern, msg)
            for match in matches:
                value = match if isinstance(match, str) else " ".join(match)
                value = value.strip()
                if len(value) >= 3:
                    facts.append({"category": category, "value": value, "confidence": confidence, "source": "rule_extraction"})

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

    def _save_to_sqlite(self, fact: dict, session_id: str):
        """Sprint 3: Also save to SQLite memory for structured retrieval."""
        if not self.sqlite_memory:
            return
        try:
            category = fact.get("category", "learning")
            value = fact.get("value", "")
            if category == "forget":
                # Mark matching long memories as expired
                memories = self.sqlite_memory.get_long_memories(limit=50)
                for mem in memories:
                    if value.lower() in mem.get("content", "").lower():
                        self.sqlite_memory.delete_long_memory(mem["id"])
                        logger.info("[KnowledgeExtractor] Forgot memory: %s", mem["content"][:50])
                return
            if category == "preference":
                self.sqlite_memory.set_preference("inferred", f"pref_{value[:30]}", value, source="inferred")
            elif category == "project":
                # Try to update project context
                parts = value.split()
                if len(parts) >= 2:
                    slug = parts[0]
                    info = " ".join(parts[1:])
                    project = self.sqlite_memory.get_project(slug)
                    if project:
                        existing_notes = project.get("notes", "") or ""
                        new_notes = f"{existing_notes}\n{info}".strip() if existing_notes else info
                        self.sqlite_memory.update_project(slug, notes=new_notes)
                        return
                self.sqlite_memory.add_long_memory(category=category, content=value)
            else:
                self.sqlite_memory.add_long_memory(
                    category=category,
                    content=value,
                    project_slug=None,
                )
        except Exception as exc:
            logger.warning("[KnowledgeExtractor] SQLite save failed: %s", exc)
