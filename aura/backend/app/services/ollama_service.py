import json
import time
from typing import AsyncGenerator, Iterable, Optional

import httpx

from app.config.system_prompt import SYSTEM_PROMPT_LOCAL
from app.core.config import Settings
from app.core.exceptions import ModelUnavailableError, OllamaUnavailableError
from app.models.chat_models import ChatHistoryItem

SYSTEM_PROMPT = SYSTEM_PROMPT_LOCAL


class OllamaService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.settings.ollama_url}/api/tags")
                response.raise_for_status()
            payload = response.json()
        except Exception:
            return []
        return [item.get("name", "") for item in payload.get("models", []) if item.get("name")]

    async def health_details(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.settings.ollama_url}/api/tags")
                response.raise_for_status()
            payload = response.json()
            models = [item.get("name", "") for item in payload.get("models", []) if item.get("name")]
            return {
                "status": "online",
                "url": self.settings.ollama_url,
                "model": self.settings.model_name,
                "model_available": self.settings.model_name in models,
                "models": models,
            }
        except Exception as exc:
            return {
                "status": "offline",
                "url": self.settings.ollama_url,
                "model": self.settings.model_name,
                "model_available": False,
                "models": [],
                "error": str(exc),
            }

    async def check_health(self) -> str:
        return (await self.health_details())["status"]

    async def generate_response(
        self,
        message: str,
        history: Iterable[ChatHistoryItem],
        temperature: float = 0.2,
        think: bool = False,
        system_prompt: Optional[str] = None,
    ) -> tuple[str, int]:
        # Always use condensed local prompt — full prompt is too large for local models
        messages = []
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
        for item in history:
            messages.append({"role": item.role, "content": item.content})
        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.settings.model_name,
            "messages": messages,
            "stream": False,
            "think": False,
            "options": {
                "temperature": temperature,
            },
        }

        started = time.perf_counter()
        try:
            timeout = httpx.Timeout(
                timeout=float(self.settings.llm_timeout),
                connect=5.0,
                read=float(self.settings.llm_timeout),
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{self.settings.ollama_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(
                f"Não foi possível conectar ao Ollama em {self.settings.ollama_url}. Inicie o serviço local antes de usar o chat.",
                details={"url": self.settings.ollama_url, "reason": str(exc)},
            ) from exc
        except httpx.TimeoutException as exc:
            raise OllamaUnavailableError(
                "O Ollama excedeu o tempo limite para responder. Verifique se o serviço está saudável e se o modelo está carregado.",
                details={"url": self.settings.ollama_url, "reason": str(exc)},
            ) from exc
        except httpx.HTTPStatusError as exc:
            error_text = exc.response.text.strip()
            lowered = error_text.lower()
            if exc.response.status_code == 404 or "model" in lowered and "not found" in lowered:
                raise ModelUnavailableError(
                    f"O modelo local '{self.settings.model_name}' não está disponível no Ollama.",
                    details={
                        "url": self.settings.ollama_url,
                        "model": self.settings.model_name,
                        "status_code": exc.response.status_code,
                        "body": error_text[:500],
                    },
                ) from exc
            raise OllamaUnavailableError(
                "O Ollama respondeu com erro ao gerar a mensagem.",
                details={"status_code": exc.response.status_code, "body": error_text[:500]},
            ) from exc
        except Exception as exc:
            raise OllamaUnavailableError(
                "Não foi possível obter resposta do Ollama. Verifique se ele está ativo e acessível.",
                details={"reason": str(exc)},
            ) from exc

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        content = data.get("message", {}).get("content", "")
        return content.strip(), elapsed_ms

    async def generate_stream(
        self,
        message: str,
        history: Iterable,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama using /api/chat with stream=True."""
        # Always use condensed local prompt — full prompt is too large for local models
        messages = []
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
        for item in history:
            if hasattr(item, "role"):
                messages.append({"role": item.role, "content": item.content})
            elif isinstance(item, dict):
                messages.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.settings.model_name,
            "messages": messages,
            "stream": True,
            "think": False,
            "options": {"temperature": 0.2},
        }

        timeout = httpx.Timeout(timeout=float(self.settings.llm_timeout), connect=5.0, read=float(self.settings.llm_timeout))
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", f"{self.settings.ollama_url}/api/chat", json=payload) as response:
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
