class AuraError(Exception):
    def __init__(self, code: str, message: str, details=None, status_code: int = 400):
        self.code = code
        self.message = message
        self.details = details
        self.status_code = status_code
        super().__init__(message)


class AuthError(AuraError):
    def __init__(self, message: str = "Token inválido ou ausente"):
        super().__init__("auth_error", message, status_code=401)


class CommandBlockedError(AuraError):
    def __init__(self, message: str = "Comando bloqueado pela política de segurança", details=None):
        super().__init__("command_blocked", message, details=details, status_code=403)


class ExternalServiceError(AuraError):
    def __init__(self, message: str = "Serviço externo indisponível", details=None):
        super().__init__("external_service_error", message, details=details, status_code=503)


class ConfigurationError(AuraError):
    def __init__(self, message: str = "Configuração inválida", details=None):
        super().__init__("configuration_error", message, details=details, status_code=500)


class OllamaUnavailableError(ExternalServiceError):
    def __init__(self, message: str = "Ollama indisponível", details=None):
        super().__init__(message, details=details)
        self.code = "ollama_unavailable"


class ModelUnavailableError(ExternalServiceError):
    def __init__(self, message: str = "Modelo local indisponível", details=None):
        super().__init__(message, details=details)
        self.code = "model_unavailable"


class ProviderUnavailableError(ExternalServiceError):
    def __init__(self, message: str = "Provider indisponível", details=None):
        super().__init__(message, details=details)
        self.code = "provider_unavailable"


class ProviderAuthError(AuraError):
    def __init__(self, message: str = "Credencial do provider inválida", details=None):
        super().__init__("provider_auth_error", message, details=details, status_code=401)


class ProviderRateLimitError(ExternalServiceError):
    def __init__(self, message: str = "Rate limit do provider excedido", details=None):
        super().__init__(message, details=details)
        self.code = "provider_rate_limit"
