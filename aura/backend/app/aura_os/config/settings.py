from typing import Dict

from app.core.config import Settings


class AuraOSSettings:
    def __init__(self, settings: Settings):
        self.settings = settings

    def providers(self) -> Dict[str, Dict[str, object]]:
        return {
            "ollama": {
                "configured": True,
                "model": self.settings.model_name,
                "url": self.settings.ollama_url,
            },
            "openai": {
                "configured": False,
                "model": "",
            },
            "anthropic": {
                "configured": False,
                "model": "",
            },
        }

    def security_policy(self) -> Dict[str, object]:
        return {
            "local_first": True,
            "require_auth": self.settings.require_auth,
            "auth_mode": self.settings.auth_mode,
            "command_timeout": self.settings.command_timeout,
            "blocked_patterns": [
                "rm",
                "rm -rf",
                "sudo rm",
                "mkfs",
                "dd",
                "shutdown",
                "reboot",
                "killall",
            ],
        }
