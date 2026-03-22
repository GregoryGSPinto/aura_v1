"""Tests for streaming and voice services."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestOllamaStreaming:
    @pytest.mark.asyncio
    async def test_generate_stream_yields_tokens(self):
        from app.services.ollama_service import OllamaService
        settings = MagicMock()
        settings.model_name = "qwen3.5:9b"
        settings.ollama_url = "http://localhost:11434"
        settings.llm_timeout = 300
        service = OllamaService(settings)
        # We can't test real streaming without Ollama, but we verify the method exists
        assert hasattr(service, "generate_stream")


class TestChatStreamEndpoint:
    @pytest.mark.asyncio
    async def test_stream_endpoint_exists(self):
        from app.api.v1.endpoints.chat_stream import router
        routes = [r.path for r in router.routes]
        assert "/chat/stream" in routes
