from app.aura_os.config.models import ProviderStatus


class AnthropicProvider:
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            name="anthropic",
            configured=False,
            available=False,
            model=None,
            details={"reason": "not_configured"},
        )
