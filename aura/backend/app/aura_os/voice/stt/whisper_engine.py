from typing import Dict, Optional


class WhisperEngine:
    provider_name = "whisper"

    def __init__(self, model_name: str = "base"):
        self.model_name = model_name

    def ready(self) -> bool:
        return True

    def transcribe(self, audio: bytes, metadata: Optional[Dict[str, str]] = None) -> str:
        metadata = metadata or {}
        if metadata.get("transcript_hint"):
            return metadata["transcript_hint"]
        try:
            decoded = audio.decode("utf-8").strip()
        except Exception:
            decoded = ""
        return decoded

    def notes(self):
        return [
            "Whisper runtime v1 usa transcrição local por hint/text fallback.",
            "Integração com biblioteca Whisper pode ser conectada sem mudar a API.",
        ]
