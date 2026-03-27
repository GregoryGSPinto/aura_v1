"""Tests for KnowledgeExtractor and ProactiveService."""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestKnowledgeExtractor:
    def _make_extractor(self):
        from app.services.knowledge_extractor import KnowledgeExtractor
        memory = MagicMock()
        return KnowledgeExtractor(memory_service=memory)

    def test_extracts_preference(self):
        ext = self._make_extractor()
        facts = ext._extract_rules("prefiro React do que Angular")
        assert any(f["category"] == "preference" for f in facts)

    def test_extracts_fact(self):
        ext = self._make_extractor()
        facts = ext._extract_rules("trabalho como maquinista ferroviário.")
        assert any(f["category"] == "fact" for f in facts)

    def test_extracts_goal(self):
        ext = self._make_extractor()
        facts = ext._extract_rules("quero ser Senior AI Architect.")
        assert any(f["category"] == "goal" for f in facts)

    def test_ignores_short_matches(self):
        ext = self._make_extractor()
        facts = ext._extract_rules("prefiro a do que b")
        # "a" is too short (< 5 chars), should be ignored
        for f in facts:
            assert len(f["value"]) > 5

    @pytest.mark.asyncio
    async def test_saves_to_memory(self):
        from app.services.knowledge_extractor import KnowledgeExtractor
        memory = MagicMock()
        ext = KnowledgeExtractor(memory_service=memory)
        await ext.extract_and_save("trabalho como maquinista ferroviário.", "Legal!", "session-1")
        memory.remember_companion_item.assert_called()


class TestProactiveService:
    def test_should_run_at_correct_time(self):
        from app.services.proactive_service import ProactiveService
        from datetime import datetime
        service = ProactiveService()
        routine = {"name": "test", "schedule": {"hour": 8, "minute": 0}, "enabled": True}
        at_8 = datetime(2026, 3, 22, 8, 0, 0)
        at_9 = datetime(2026, 3, 22, 9, 0, 0)
        assert service._should_run(routine, at_8) is True
        assert service._should_run(routine, at_9) is False

    def test_interval_schedule(self):
        from app.services.proactive_service import ProactiveService
        from datetime import datetime
        service = ProactiveService()
        routine = {"name": "test", "schedule": {"interval_minutes": 60}, "enabled": True}
        at_00 = datetime(2026, 3, 22, 8, 0, 0)
        at_30 = datetime(2026, 3, 22, 8, 30, 0)
        assert service._should_run(routine, at_00) is True
        assert service._should_run(routine, at_30) is False

    @pytest.mark.asyncio
    async def test_health_check_returns_data(self):
        from app.services.proactive_service import ProactiveService
        service = ProactiveService()
        result = await service._system_health_check()
        assert result["type"] == "health_check"
