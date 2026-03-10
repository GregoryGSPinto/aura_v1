from app.aura_os.config.models import ProviderStatus
from app.core.exceptions import ExternalServiceError


class OpenAIProvider:
    def __init__(self, api_key: str = "", model_name: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model_name = model_name

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            name="openai",
            configured=bool(self.api_key),
            available=bool(self.api_key),
            model=self.model_name if self.api_key else None,
            details={"reason": "not_configured" if not self.api_key else "api_key_present"},
        )

    async def generate(self, prompt: str, task_type: str = "conversation") -> str:
        if not self.api_key:
            raise ExternalServiceError("OpenAI não configurado para o runtime multi-LLM.")
        raise ExternalServiceError("OpenAIProvider v1 está preparado, mas sem transporte HTTP ativado nesta instalação.")
