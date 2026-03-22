"""Tests for Tool Calling services."""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestToolCallParser:
    def _parser(self):
        from app.services.tool_call_parser import ToolCallParser
        return ToolCallParser()

    def test_parses_tool_call_block(self):
        parser = self._parser()
        response = 'Vou abrir o projeto.\n```tool_call\n{"tool": "vscode.open_project", "params": {"project": "aura"}, "reason": "pediu"}\n```'
        result = parser.parse(response)
        assert result is not None
        assert result["tool"] == "vscode.open_project"
        assert result["params"]["project"] == "aura"

    def test_parses_inline_json(self):
        parser = self._parser()
        response = 'Aqui: {"tool": "system.summary", "params": {}}'
        result = parser.parse(response)
        assert result is not None
        assert result["tool"] == "system.summary"

    def test_returns_none_for_no_tool_call(self):
        parser = self._parser()
        result = parser.parse("Olá, como posso ajudar?")
        assert result is None

    def test_extracts_text_around_tool_call(self):
        parser = self._parser()
        response = 'Texto antes.\n```tool_call\n{"tool": "x.y", "params": {}}\n```\nTexto depois.'
        result = parser.parse(response)
        assert result is not None
        assert "Texto antes" in result["raw_text"]

    def test_returns_none_for_empty(self):
        parser = self._parser()
        assert parser.parse("") is None
        assert parser.parse(None) is None


class TestToolExecutorService:
    @pytest.mark.asyncio
    async def test_executes_allowed_tool(self):
        from app.services.tool_executor_service import ToolExecutorService
        mock_tool = MagicMock()
        mock_tool.summary = MagicMock(return_value={"cpu": 10})
        executor = ToolExecutorService(tools={"system": mock_tool}, governance=None, permissions=None, persistence=None)
        result = await executor.execute({"tool": "system.summary", "params": {}})
        assert result["status"] == "executed"

    @pytest.mark.asyncio
    async def test_blocks_dangerous_tool(self):
        from app.services.tool_executor_service import ToolExecutorService
        executor = ToolExecutorService(tools={}, governance=None, permissions=None, persistence=None)
        result = await executor.execute({"tool": "terminal.rm", "params": {}})
        assert result["status"] == "blocked"

    @pytest.mark.asyncio
    async def test_requires_confirmation(self):
        from app.services.tool_executor_service import ToolExecutorService
        mock_tool = MagicMock()
        executor = ToolExecutorService(tools={"terminal": mock_tool}, governance=None, permissions=None, persistence=None)
        result = await executor.execute({"tool": "terminal.execute", "params": {"command": "ls"}})
        assert result["status"] == "needs_confirmation"

    @pytest.mark.asyncio
    async def test_tool_not_found(self):
        from app.services.tool_executor_service import ToolExecutorService
        executor = ToolExecutorService(tools={}, governance=None, permissions=None, persistence=None)
        result = await executor.execute({"tool": "nonexistent.method", "params": {}})
        assert result["status"] == "error"


class TestToolSchemaService:
    def test_returns_available_tools(self):
        from app.services.tool_schema_service import ToolSchemaService
        service = ToolSchemaService()
        tools = service.get_available_tools()
        assert len(tools) > 0
        assert all("name" in t for t in tools)

    def test_generates_prompt_block(self):
        from app.services.tool_schema_service import ToolSchemaService
        service = ToolSchemaService()
        block = service.get_tools_prompt_block()
        assert "<tools_disponiveis>" in block
        assert "terminal.execute" in block
        assert "</tools_disponiveis>" in block
