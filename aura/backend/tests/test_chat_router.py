"""Tests for ChatRouterService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestChatRouterHeuristic:
    def _make_router(self):
        from app.services.chat_router_service import ChatRouterService
        return ChatRouterService(
            ollama_service=MagicMock(),
            aura_os=MagicMock(),
            behavior_service=MagicMock(),
            action_governance=MagicMock(),
        )

    def test_conversation_default(self):
        router = self._make_router()
        assert router._heuristic_classify("oi tudo bem") == "conversation"

    def test_action_keywords(self):
        router = self._make_router()
        assert router._heuristic_classify("abre o projeto") == "action"
        assert router._heuristic_classify("roda o deploy") == "action"
        assert router._heuristic_classify("instala o pacote") == "action"

    def test_research_keywords(self):
        router = self._make_router()
        assert router._heuristic_classify("pesquisa vagas de AI") == "research"
        assert router._heuristic_classify("busca informações") == "research"

    def test_system_keywords(self):
        router = self._make_router()
        assert router._heuristic_classify("status do sistema") == "system"
        assert router._heuristic_classify("mostra o health") == "system"

    def test_should_use_agent(self):
        router = self._make_router()
        assert router._should_use_agent("action") is True
        assert router._should_use_agent("research") is True
        assert router._should_use_agent("system") is True
        assert router._should_use_agent("conversation") is False


@pytest.mark.asyncio
class TestChatRouterRouting:
    async def test_conversation_routes_to_chat(self):
        from app.services.chat_router_service import ChatRouterService
        ollama = AsyncMock()
        ollama.generate_response = AsyncMock(return_value=("Oi Gregory!", 100))
        behavior = MagicMock()
        behavior.build_chat_prompt = MagicMock(return_value="system prompt")
        router = ChatRouterService(ollama_service=ollama, aura_os=MagicMock(), behavior_service=behavior, action_governance=MagicMock())
        result = await router.process("oi tudo bem", {"history": []})
        assert result["route"] == "chat"
        assert result["response"] == "Oi Gregory!"

    async def test_action_routes_to_agent(self):
        from app.services.chat_router_service import ChatRouterService
        from app.aura_os.config.models import AuraOSExecutionResponse
        aura_os = MagicMock()
        aura_os.reasoner = MagicMock()
        aura_os.reasoner.analyze = MagicMock(return_value={"intent": "developer", "reasoning": "action detected"})
        exec_response = AuraOSExecutionResponse(
            goal="abre o projeto", intent="developer", reasoning="Opening project",
            plan_status="planned", planned_steps=1, started=True, route={"command": "open_project"},
            memory_snapshot={}, notes=["Projeto aberto."],
        )
        aura_os.execute = MagicMock(return_value=exec_response)
        governance = MagicMock()
        governance.preview = MagicMock(return_value=MagicMock(risk_score=1))
        router = ChatRouterService(ollama_service=AsyncMock(), aura_os=aura_os, behavior_service=MagicMock(), action_governance=governance)
        result = await router.process("abre o projeto aura", {})
        assert result["route"] == "agent"

    async def test_agent_failure_falls_back(self):
        from app.services.chat_router_service import ChatRouterService
        aura_os = MagicMock()
        aura_os.reasoner = MagicMock()
        aura_os.reasoner.analyze = MagicMock(return_value={"intent": "developer"})
        aura_os.execute = MagicMock(side_effect=Exception("boom"))
        governance = MagicMock()
        governance.preview = MagicMock(return_value=MagicMock(risk_score=1))
        ollama = AsyncMock()
        ollama.generate_response = AsyncMock(return_value=("Fallback response", 50))
        behavior = MagicMock()
        behavior.build_chat_prompt = MagicMock(return_value="prompt")
        router = ChatRouterService(ollama_service=ollama, aura_os=aura_os, behavior_service=behavior, action_governance=governance)
        result = await router.process("roda o deploy", {"history": []})
        assert result["route"] == "agent_fallback"

    async def test_blocked_action_returns_governance(self):
        from app.services.chat_router_service import ChatRouterService
        governance = MagicMock()
        governance.preview = MagicMock(return_value=MagicMock(risk_score=5))
        router = ChatRouterService(
            ollama_service=AsyncMock(), aura_os=MagicMock(), behavior_service=MagicMock(), action_governance=governance,
        )
        # Force action intent
        router._classify_intent = MagicMock(return_value="action")
        result = await router.process("deleta tudo", {})
        assert result["provider"] == "governance"
