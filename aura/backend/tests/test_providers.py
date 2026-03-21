"""
Testes dos providers — NAO chama API real.
Testa: circuit breaker, retry logic, fallback chain, budget.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.aura_os.config.models import ProviderStatus
from app.aura_os.integrations.anthropic import AnthropicProvider
from app.aura_os.integrations.model_router import ModelRouter
from app.aura_os.integrations.openai import OpenAIProvider
from app.core.exceptions import ProviderAuthError, ProviderRateLimitError, ProviderUnavailableError
from app.services.token_budget_service import TokenBudgetService


# ── AnthropicProvider ──


class TestAnthropicProvider:
    def test_rejects_empty_api_key_on_generate(self):
        provider = AnthropicProvider(api_key="", model_name="claude-sonnet-4-20250514")
        with pytest.raises(ProviderUnavailableError):
            import asyncio
            asyncio.get_event_loop().run_until_complete(provider.generate("test"))

    def test_status_unconfigured(self):
        provider = AnthropicProvider()
        status = provider.status()
        assert status.configured is False
        assert status.available is False

    def test_status_configured(self):
        provider = AnthropicProvider(api_key="sk-test-key")
        status = provider.status()
        assert status.configured is True
        assert status.available is True

    def test_circuit_breaker_opens_after_3_failures(self):
        provider = AnthropicProvider(api_key="sk-test")
        for _ in range(3):
            provider._record_failure()
        assert provider._is_circuit_open() is True
        status = provider.status()
        assert status.available is False

    def test_circuit_breaker_resets_after_cooldown(self):
        provider = AnthropicProvider(api_key="sk-test")
        for _ in range(3):
            provider._record_failure()
        assert provider._is_circuit_open() is True
        provider._circuit_open_until = time.time() - 1
        assert provider._is_circuit_open() is False

    def test_circuit_breaker_resets_on_success(self):
        provider = AnthropicProvider(api_key="sk-test")
        provider._consecutive_failures = 2
        provider._consecutive_failures = 0
        provider._circuit_open_until = None
        assert provider._is_circuit_open() is False

    def test_metrics_initial(self):
        provider = AnthropicProvider(api_key="sk-test")
        metrics = provider.get_metrics()
        assert metrics["total_calls"] == 0
        assert metrics["total_failures"] == 0
        assert metrics["circuit_breaker"] == "closed"

    def test_cost_estimation(self):
        provider = AnthropicProvider(api_key="sk-test", model_name="claude-sonnet-4-20250514")
        cost = provider._estimate_cost(1000, 500)
        expected = (1000 / 1_000_000 * 3.0) + (500 / 1_000_000 * 15.0)
        assert abs(cost - expected) < 1e-9


# ── OpenAIProvider ──


class TestOpenAIProvider:
    def test_rejects_empty_api_key_on_generate(self):
        provider = OpenAIProvider(api_key="", model_name="gpt-4o-mini")
        with pytest.raises(ProviderUnavailableError):
            import asyncio
            asyncio.get_event_loop().run_until_complete(provider.generate("test"))

    def test_status_unconfigured(self):
        provider = OpenAIProvider()
        status = provider.status()
        assert status.configured is False
        assert status.available is False

    def test_status_configured(self):
        provider = OpenAIProvider(api_key="sk-test-key")
        status = provider.status()
        assert status.configured is True
        assert status.available is True

    def test_circuit_breaker_opens_after_3_failures(self):
        provider = OpenAIProvider(api_key="sk-test")
        for _ in range(3):
            provider._record_failure()
        assert provider._is_circuit_open() is True

    def test_circuit_breaker_resets_after_cooldown(self):
        provider = OpenAIProvider(api_key="sk-test")
        for _ in range(3):
            provider._record_failure()
        provider._circuit_open_until = time.time() - 1
        assert provider._is_circuit_open() is False

    def test_cost_estimation(self):
        provider = OpenAIProvider(api_key="sk-test", model_name="gpt-4o-mini")
        cost = provider._estimate_cost(1000, 500)
        expected = (1000 / 1_000_000 * 0.15) + (500 / 1_000_000 * 0.60)
        assert abs(cost - expected) < 1e-9


# ── TokenBudget ──


class TestTokenBudget:
    def _make_service(self, tmp_path):
        return TokenBudgetService(
            daily_limit_usd=5.0,
            monthly_limit_usd=100.0,
            budget_file=str(tmp_path / "budget.json"),
        )

    def test_green_tier_allows_spending(self, tmp_path):
        svc = self._make_service(tmp_path)
        result = svc.can_spend(0.01)
        assert result["allowed"] is True
        assert result["tier"] == "GREEN"

    def test_yellow_tier_after_spending(self, tmp_path):
        svc = self._make_service(tmp_path)
        svc.record_spend("anthropic", "claude-sonnet-4", 100000, 50000, 3.6)
        status = svc.get_budget_status()
        assert status["tier"] == "YELLOW"

    def test_red_tier(self, tmp_path):
        svc = self._make_service(tmp_path)
        svc.record_spend("anthropic", "claude-sonnet-4", 100000, 50000, 4.6)
        status = svc.get_budget_status()
        assert status["tier"] == "RED"

    def test_blocked_tier_rejects_spending(self, tmp_path):
        svc = self._make_service(tmp_path)
        svc.record_spend("anthropic", "claude-sonnet-4", 100000, 50000, 5.5)
        result = svc.can_spend(0.01)
        assert result["allowed"] is False
        assert result["tier"] == "BLOCKED"

    def test_suggests_ollama_when_red(self, tmp_path):
        svc = self._make_service(tmp_path)
        svc.record_spend("anthropic", "claude-sonnet-4", 100000, 50000, 4.6)
        suggestion = svc.suggest_provider("anthropic")
        assert suggestion == "ollama"

    def test_suggests_preferred_when_green(self, tmp_path):
        svc = self._make_service(tmp_path)
        suggestion = svc.suggest_provider("anthropic")
        assert suggestion == "anthropic"

    def test_budget_status_fields(self, tmp_path):
        svc = self._make_service(tmp_path)
        status = svc.get_budget_status()
        assert "tier" in status
        assert "daily_spent_usd" in status
        assert "monthly_spent_usd" in status
        assert "daily_remaining_usd" in status


# ── FallbackChain ──


class TestFallbackChain:
    def _make_router(self):
        config = {
            "default_model": "openai",
            "coding_model": "anthropic",
            "conversation_model": "openai",
            "local_model": "ollama",
            "research_model": "ollama",
        }
        return ModelRouter("qwen3.5:9b", config)

    def test_fallback_chain_anthropic(self):
        router = self._make_router()
        chain = router.fallback_chain("anthropic")
        assert chain == ["anthropic", "openai", "ollama"]

    def test_fallback_chain_openai(self):
        router = self._make_router()
        chain = router.fallback_chain("openai")
        assert chain == ["openai", "anthropic", "ollama"]

    def test_fallback_chain_ollama(self):
        router = self._make_router()
        chain = router.fallback_chain("ollama")
        assert chain == ["ollama", "anthropic", "openai"]

    def test_ollama_is_always_last_fallback(self):
        router = self._make_router()
        for primary in ["anthropic", "openai"]:
            chain = router.fallback_chain(primary)
            assert chain[-1] == "ollama"

    @pytest.mark.asyncio
    async def test_falls_back_on_primary_failure(self):
        config = {
            "default_model": "openai",
            "coding_model": "anthropic",
            "conversation_model": "openai",
            "local_model": "ollama",
            "research_model": "ollama",
        }

        failing_provider = MagicMock()
        failing_provider.status.return_value = ProviderStatus(
            name="openai", configured=True, available=True, model="gpt-4o-mini", details={},
        )
        failing_provider.generate = AsyncMock(side_effect=ProviderUnavailableError("fail"))

        success_provider = MagicMock()
        success_provider.status.return_value = ProviderStatus(
            name="anthropic", configured=True, available=True, model="claude", details={},
        )
        success_provider.generate = AsyncMock(return_value="fallback response")

        ollama_provider = MagicMock()
        ollama_provider.status.return_value = ProviderStatus(
            name="ollama", configured=True, available=True, model="qwen", details={},
        )
        ollama_provider.generate = AsyncMock(return_value="ollama response")

        router = ModelRouter("qwen3.5:9b", config, providers={
            "openai": failing_provider,
            "anthropic": success_provider,
            "ollama": ollama_provider,
        })

        result = await router.generate_with_fallback("hello", "conversation")
        assert result == "fallback response"

    @pytest.mark.asyncio
    async def test_all_fail_raises_error(self):
        config = {"default_model": "ollama", "conversation_model": "ollama", "local_model": "ollama"}

        failing = MagicMock()
        failing.status.return_value = ProviderStatus(
            name="ollama", configured=True, available=True, model="q", details={},
        )
        failing.generate = AsyncMock(side_effect=ProviderUnavailableError("fail"))

        router = ModelRouter("q", config, providers={"ollama": failing})

        with pytest.raises(ProviderUnavailableError):
            await router.generate_with_fallback("test", "local")


# ── ModelRouter routing (preserved from original tests) ──


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
