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

