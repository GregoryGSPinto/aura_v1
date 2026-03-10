from app.aura_os.config.models import ProviderStatus


class OpenAIProvider:
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            name="openai",
            configured=False,
            available=False,
            model=None,
            details={"reason": "not_configured"},
        )
