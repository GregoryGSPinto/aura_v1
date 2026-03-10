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
