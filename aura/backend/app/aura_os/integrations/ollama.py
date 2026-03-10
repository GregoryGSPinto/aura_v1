from app.aura_os.config.models import ProviderStatus
from app.services.ollama_service import OllamaService


class OllamaProvider:
    def __init__(self, ollama_service: OllamaService, model_name: str):
        self.ollama_service = ollama_service
        self.model_name = model_name

    async def status(self) -> ProviderStatus:
        health = await self.ollama_service.check_health()
        return ProviderStatus(
            name="ollama",
            configured=True,
            available=health == "online",
            model=self.model_name,
            details={"health": health},
        )

    async def generate(self, prompt: str, task_type: str = "local") -> str:
        response, _ = await self.ollama_service.generate_response(
            message=prompt,
            history=[],
            temperature=0.2 if task_type != "conversation" else 0.5,
            think=task_type in {"coding", "reasoning", "research"},
        )
        return response
