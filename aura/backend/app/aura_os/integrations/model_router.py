import asyncio
import inspect
import logging
from typing import Any, Dict, List, Optional

from app.core.exceptions import ProviderUnavailableError

logger = logging.getLogger("aura.providers")

FALLBACK_ORDER = {
    "anthropic": ["openai", "ollama"],
    "openai": ["anthropic", "ollama"],
    "ollama": ["anthropic", "openai"],
}


class ModelRouter:
    def __init__(self, default_model: str, config: Dict[str, object], providers: Optional[Dict[str, Any]] = None):
        self.default_model = default_model
        self.config = config
        self.available_models = ["qwen3.5:9b", "llama3", "mistral", "qwen2.5"]
        self.providers = providers or {}
        self._override: Optional[str] = None

    def route(self, task_type: str) -> Dict[str, object]:
        if task_type in {"developer", "coding", "reasoning"}:
            provider = str(self.config.get("coding_model", "anthropic"))
            model = "qwen3.5:9b" if provider == "ollama" else provider
        elif task_type in {"research", "summarize"}:
            provider = str(self.config.get("research_model", "openai"))
            model = self.default_model if provider == "ollama" else provider
        elif task_type in {"local", "system"}:
            provider = str(self.config.get("local_model", "ollama"))
            model = self.default_model if provider == "ollama" else provider
        else:
            provider = str(self.config.get("conversation_model", self.config.get("default_model", "openai")))
            model = self.default_model if provider == "ollama" else provider
        return {"provider": provider, "selected_model": model, "candidates": self.available_models, "task_type": task_type}

    def set_override(self, provider: Optional[str]) -> None:
        self._override = provider if provider and provider != "auto" else None

    def get_override(self) -> Optional[str]:
        return self._override

    def fallback_chain(self, primary: str) -> List[str]:
        chain = [primary] + FALLBACK_ORDER.get(primary, ["ollama"])
        if "ollama" not in chain:
            chain.append("ollama")
        return chain

    async def _get_status(self, provider):
        result = provider.status()
        if inspect.isawaitable(result):
            return await result
        return result

    async def generate_with_fallback(self, prompt: str, task_type: str) -> str:
        if self._override:
            provider = self.providers.get(self._override)
            if provider is None:
                raise ProviderUnavailableError(
                    f"Provider override '{self._override}' nao encontrado.",
                    details={"override": self._override},
                )
            logger.info("[ModelRouter] Manual override active: %s", self._override)
            return await provider.generate(prompt, task_type)

        route_info = self.route(task_type)
        primary = route_info["provider"]
        chain = self.fallback_chain(primary)

        last_error: Optional[Exception] = None
        for idx, provider_name in enumerate(chain):
            provider = self.providers.get(provider_name)
            if provider is None:
                continue

            try:
                status = await self._get_status(provider)
                if hasattr(status, "available") and not status.available:
                    logger.warning("[ModelRouter] %s not available, skipping.", provider_name)
                    continue
            except Exception:
                pass

            try:
                result = await provider.generate(prompt, task_type)
                if idx > 0:
                    logger.info("[ModelRouter] Fallback to %s succeeded for task_type=%s.", provider_name, task_type)
                return result
            except Exception as exc:
                last_error = exc
                next_provider = chain[idx + 1] if idx + 1 < len(chain) else None
                if next_provider:
                    logger.warning(
                        "[ModelRouter] %s failed. Falling back to %s. Error: %s",
                        provider_name, next_provider, exc,
                    )
                else:
                    logger.error("[ModelRouter] %s failed. No more fallbacks. Error: %s", provider_name, exc)

        raise ProviderUnavailableError(
            "Todos os providers falharam.",
            details={"task_type": task_type, "chain": chain, "last_error": str(last_error)},
        )

    async def providers_health(self) -> Dict[str, Any]:
        statuses = {}
        for name, provider in self.providers.items():
            try:
                status = await self._get_status(provider)
                statuses[name] = {
                    "status": "online" if status.available else "offline",
                    "model": status.model,
                    "configured": status.configured,
                    "details": status.details,
                }
            except Exception as exc:
                statuses[name] = {"status": "error", "error": str(exc)}

        route_info = self.route("conversation")
        primary = route_info["provider"]
        override = self._override
        return {
            "providers": statuses,
            "fallback_chain": self.fallback_chain(primary),
            "active_provider": override or primary,
            "override": override,
            "mode": "manual" if override else "auto",
        }

    def overview(self) -> Dict[str, List[str]]:
        return {
            "available_models": self.available_models,
            "default_model": self.default_model,
            "routing": self.config,
        }
