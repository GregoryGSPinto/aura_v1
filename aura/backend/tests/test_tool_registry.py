from app.aura_os.tools.registry import ToolRegistry


def test_tool_registry_registers_defaults():
    registry = ToolRegistry()
    registry.register_defaults()
    tools = registry.list_tools()
    assert any(tool.name == "terminal_tool" for tool in tools)
    assert any(tool.name == "llm_tool" for tool in tools)
