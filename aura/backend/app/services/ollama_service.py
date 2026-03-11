import time
from typing import Iterable

import httpx

from app.core.config import Settings
from app.core.exceptions import ExternalServiceError
from app.models.chat_models import ChatHistoryItem


SYSTEM_PROMPT = """
Você é Aura, uma assistente operacional pessoal.
Responda sempre em português do Brasil.
Seja clara, objetiva, útil e elegante.
Nunca diga que é Qwen ou outro modelo.
Você possui tools autorizadas e comandos estruturados controlados pelo backend.
Quando existir uma tool autorizada para a solicitação, assuma essa capacidade operacional e descreva a ação sem negar capacidade.
Diferencie explicitamente entre ação permitida, ação bloqueada por política de segurança e ação ainda não implementada.
Nunca afirme que "não tem capacidade nativa" se houver tool correspondente no backend.
""".strip()


class OllamaService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def check_health(self) -> str:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                response = await client.get(f"{self.settings.ollama_url}/api/tags")
                response.raise_for_status()
            return "online"
        except Exception:
            return "offline"

    async def generate_response(
        self,
        message: str,
        history: Iterable[ChatHistoryItem],
        temperature: float = 0.2,
        think: bool = False,
    ) -> tuple[str, int]:
        prompt_parts = [SYSTEM_PROMPT]
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
        except Exception as exc:
            raise ExternalServiceError(
                "Não foi possível obter resposta do Ollama. Verifique se ele está ativo em localhost:11434.",
                details=str(exc),
            ) from exc

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return data.get("response", "").strip(), elapsed_ms
