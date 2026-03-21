from pathlib import Path
from typing import Dict

import yaml

from app.core.config import Settings


class AuraOSSettings:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.models_config_path = Path(__file__).resolve().parents[4] / "config" / "models.yaml"

    def providers(self) -> Dict[str, Dict[str, object]]:
        return {
            "ollama": {
                "configured": True,
                "model": self.settings.model_name,
                "url": self.settings.ollama_url,
            },
            "openai": {
                "configured": bool(self.settings.openai_api_key),
                "model": "gpt-4o-mini" if self.settings.openai_api_key else "",
            },
            "anthropic": {
                "configured": bool(self.settings.anthropic_api_key),
                "model": "claude-sonnet-4-20250514" if self.settings.anthropic_api_key else "",
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

    def model_routing(self) -> Dict[str, object]:
        defaults = {
            "default_model": "openai",
            "coding_model": "anthropic",
            "conversation_model": "openai",
            "local_model": "ollama",
            "research_model": "openai",
        }
        if not self.models_config_path.exists():
            return defaults
        try:
            payload = yaml.safe_load(self.models_config_path.read_text(encoding="utf-8")) or {}
        except Exception:
            return defaults
        defaults.update(payload)
        return defaults
