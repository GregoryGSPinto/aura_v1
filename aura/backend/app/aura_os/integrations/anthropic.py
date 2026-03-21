"""
AnthropicProvider — Cerebro elite da Aura.

Usado para: raciocinio complexo, coding, planejamento estrategico,
analise profunda, decisoes que precisam de nuance.

O ModelRouter direciona pra ca quando a tarefa exige mais do que
o modelo local entrega.
"""

import asyncio
import logging
import random
import time
from typing import Optional

import anthropic

from app.aura_os.config.models import ProviderStatus
from app.core.exceptions import ProviderAuthError, ProviderRateLimitError, ProviderUnavailableError

logger = logging.getLogger("aura.providers")

PRICING = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-haiku-3.5": {"input": 0.8, "output": 4.0},
    "claude-opus-4": {"input": 15.0, "output": 75.0},
}


def _backoff_delay(attempt: int, base: float = 1.0, max_delay: float = 30.0) -> float:
    delay = min(base * (2 ** attempt), max_delay)
    jitter = random.uniform(0, delay * 0.5)
    return delay + jitter


def _log_call(provider: str, model: str, input_tokens: int, output_tokens: int,
              latency_ms: float, cost_usd: float, success: bool):
    logger.info(
        "[%s] model=%s tokens_in=%d tokens_out=%d latency=%.0fms cost=$%.4f success=%s",
        provider, model, input_tokens, output_tokens, latency_ms, cost_usd, success,
    )


def _log_retry(provider: str, attempt: int, delay: float, reason: str):
    logger.warning("[%s] Retry #%d in %.1fs reason=%s", provider, attempt, delay, reason)


class AnthropicProvider:
    def __init__(self, api_key: str = "", model_name: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model_name = model_name
        self._client: Optional[anthropic.AsyncAnthropic] = None
        if api_key:
            self._client = anthropic.AsyncAnthropic(api_key=api_key)

        self._consecutive_failures = 0
        self._circuit_open_until: Optional[float] = None
        self._max_failures = 3
        self._cooldown_seconds = 30

        self._total_calls = 0
        self._total_failures = 0
        self._total_tokens_used = 0
        self._total_cost_usd = 0.0

    def status(self) -> ProviderStatus:
        circuit = "open" if self._is_circuit_open() else "closed"
        return ProviderStatus(
            name="anthropic",
            configured=bool(self.api_key),
            available=bool(self.api_key) and not self._is_circuit_open(),
            model=self.model_name if self.api_key else None,
            details={
                "reason": "not_configured" if not self.api_key else "api_key_present",
                "circuit_breaker": circuit,
            },
        )

    async def generate(self, prompt: str, task_type: str = "coding") -> str:
        if not self.api_key or not self._client:
            raise ProviderUnavailableError(
                "ANTHROPIC_API_KEY nao configurada.",
                details={"provider": "anthropic", "reason": "missing_api_key"},
            )

        if self._is_circuit_open():
            remaining = self._circuit_open_until - time.time()
            raise ProviderUnavailableError(
                f"AnthropicProvider circuit breaker OPEN. Retry in {remaining:.0f}s.",
                details={"provider": "anthropic", "consecutive_failures": self._consecutive_failures},
            )

        temperature = 0.2 if task_type in {"coding", "reasoning", "research"} else 0.5
        max_tokens = 4096
        max_retries = 3
        last_error: Optional[Exception] = None

        for attempt in range(max_retries + 1):
            try:
                start_time = time.time()
                self._total_calls += 1

                response = await self._client.messages.create(
                    model=self.model_name,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "user", "content": prompt}],
                )

                latency_ms = (time.time() - start_time) * 1000

                content = ""
                for block in response.content:
                    if block.type == "text":
                        content += block.text

                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                cost_usd = self._estimate_cost(input_tokens, output_tokens)

                self._total_tokens_used += input_tokens + output_tokens
                self._total_cost_usd += cost_usd

                self._consecutive_failures = 0
                self._circuit_open_until = None

                _log_call("anthropic", self.model_name, input_tokens, output_tokens, latency_ms, cost_usd, True)

                if not content.strip():
                    raise ProviderUnavailableError(
                        "A API Anthropic retornou resposta vazia.",
                        details={"provider": "anthropic"},
                    )

                return content.strip()

            except anthropic.AuthenticationError:
                self._record_failure()
                raise ProviderAuthError(
                    "ANTHROPIC_API_KEY invalida. Verifique o .env",
                    details={"provider": "anthropic"},
                )

            except anthropic.RateLimitError as exc:
                last_error = exc
                if attempt < max_retries:
                    delay = _backoff_delay(attempt)
                    _log_retry("anthropic", attempt + 1, delay, "rate_limit")
                    await asyncio.sleep(delay)
                    continue
                self._record_failure()
                raise ProviderRateLimitError(
                    f"Rate limit apos {max_retries} tentativas.",
                    details={"provider": "anthropic", "reason": str(exc)},
                ) from exc

            except anthropic.APIStatusError as exc:
                if exc.status_code >= 500:
                    last_error = exc
                    if attempt < max_retries:
                        delay = _backoff_delay(attempt)
                        _log_retry("anthropic", attempt + 1, delay, f"server_{exc.status_code}")
                        await asyncio.sleep(delay)
                        continue
                self._record_failure()
                raise ProviderUnavailableError(
                    f"Anthropic API error {exc.status_code}.",
                    details={"provider": "anthropic", "status_code": exc.status_code},
                ) from exc

            except (anthropic.APIConnectionError, anthropic.APITimeoutError) as exc:
                last_error = exc
                if attempt < max_retries:
                    delay = _backoff_delay(attempt)
                    _log_retry("anthropic", attempt + 1, delay, "connection")
                    await asyncio.sleep(delay)
                    continue
                self._record_failure()
                raise ProviderUnavailableError(
                    f"Connection failed apos {max_retries} tentativas.",
                    details={"provider": "anthropic", "reason": str(exc)},
                ) from exc

            except (ProviderUnavailableError, ProviderAuthError, ProviderRateLimitError):
                raise

            except Exception as exc:
                self._record_failure()
                raise ProviderUnavailableError(
                    f"Erro inesperado: {type(exc).__name__}: {exc}",
                    details={"provider": "anthropic"},
                ) from exc

        self._record_failure()
        raise ProviderUnavailableError(
            f"Todos os retries falharam. Ultimo erro: {last_error}",
            details={"provider": "anthropic"},
        )

    def get_metrics(self) -> dict:
        return {
            "provider": "anthropic",
            "model": self.model_name,
            "total_calls": self._total_calls,
            "total_failures": self._total_failures,
            "total_tokens": self._total_tokens_used,
            "total_cost_usd": round(self._total_cost_usd, 4),
            "circuit_breaker": "open" if self._is_circuit_open() else "closed",
            "consecutive_failures": self._consecutive_failures,
            "error_rate": round(self._total_failures / self._total_calls, 3) if self._total_calls > 0 else 0,
        }

    def _record_failure(self):
        self._consecutive_failures += 1
        self._total_failures += 1
        if self._consecutive_failures >= self._max_failures:
            self._circuit_open_until = time.time() + self._cooldown_seconds
            logger.error(
                "[anthropic] Circuit breaker OPEN after %d consecutive failures. Cooldown %ds.",
                self._consecutive_failures, self._cooldown_seconds,
            )

    def _is_circuit_open(self) -> bool:
        if self._circuit_open_until is None:
            return False
        if time.time() >= self._circuit_open_until:
            self._circuit_open_until = None
            return False
        return True

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        prices = PRICING.get(self.model_name, PRICING["claude-sonnet-4-20250514"])
        return (input_tokens / 1_000_000 * prices["input"]) + (output_tokens / 1_000_000 * prices["output"])
