from app.aura_os.integrations.model_router import ModelRouter


def test_model_router_routes_developer_tasks_to_coding_provider():
    router = ModelRouter(
        "qwen3.5:9b",
        {
            "default_model": "openai",
            "coding_model": "anthropic",
            "conversation_model": "openai",
            "local_model": "ollama",
            "research_model": "ollama",
        },
    )
    result = router.route("developer")
    assert result["provider"] == "anthropic"


def test_model_router_routes_system_tasks_to_local_provider():
    router = ModelRouter(
        "qwen3.5:9b",
        {
            "default_model": "openai",
            "coding_model": "anthropic",
            "conversation_model": "openai",
            "local_model": "ollama",
            "research_model": "ollama",
        },
    )
    result = router.route("system")
    assert result["provider"] == "ollama"
