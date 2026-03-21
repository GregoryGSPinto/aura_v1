import time
from typing import Iterable, Optional

import httpx

from app.core.config import Settings
from app.core.exceptions import ModelUnavailableError, OllamaUnavailableError
from app.models.chat_models import ChatHistoryItem
from app.prompts.aura_absolute import AURA_ABSOLUTE_PROMPT

SYSTEM_PROMPT = AURA_ABSOLUTE_PROMPT


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
        prompt_parts = [system_prompt.strip() if system_prompt else SYSTEM_PROMPT]
        for item in history:
            prompt_parts.append(f"{item.role.upper()}: {item.content}")
        prompt_parts.append(f"USER: {message}")
        prompt_parts.append("ASSISTANT:")
        prompt = "\n".join(prompt_parts)

        payload = {
            "model": self.settings.model_name,
            "prompt": prompt,
            "stream": False,
            "think": think,
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
                response = await client.post(f"{self.settings.ollama_url}/api/generate", json=payload)
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
        return data.get("response", "").strip(), elapsed_ms
