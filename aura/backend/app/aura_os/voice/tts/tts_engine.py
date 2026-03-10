import subprocess
from typing import Dict


class TTSEngine:
    provider_name = "say"

    def ready(self) -> bool:
        return True

    def speak(self, text: str, voice: str = "Luciana") -> Dict[str, object]:
        completed = subprocess.run(
            ["say", "-v", voice, text],
            capture_output=True,
            text=True,
            check=False,
        )
        return {
            "provider": self.provider_name,
            "voice": voice,
            "returncode": completed.returncode,
            "stderr": completed.stderr.strip(),
        }

    def notes(self):
        return [
            "TTS runtime v1 usa o comando nativo 'say' no macOS.",
            "Coqui ou Piper podem substituir o engine sem mudar a interface.",
        ]
