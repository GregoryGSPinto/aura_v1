"""
Sprint 12 — Voice Premium.

STT and TTS services for voice interaction.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


class STTService:
    """Speech to Text service."""

    def __init__(self):
        self._available = False
        try:
            # Try to import faster-whisper or whisper
            import importlib
            if importlib.util.find_spec("faster_whisper"):
                self._available = True
                self._engine = "faster_whisper"
            elif importlib.util.find_spec("whisper"):
                self._available = True
                self._engine = "whisper"
            else:
                self._engine = "none"
        except Exception:
            self._engine = "none"

    @property
    def available(self) -> bool:
        return self._available

    async def transcribe(self, audio_data: bytes, language: str = "pt") -> Dict[str, Any]:
        if not self._available:
            return {"error": "STT not available. Install faster-whisper or whisper.", "text": ""}
        try:
            import tempfile
            import os
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_data)
                tmp_path = f.name
            try:
                if self._engine == "faster_whisper":
                    from faster_whisper import WhisperModel
                    model = WhisperModel("base", device="cpu")
                    segments, info = model.transcribe(tmp_path, language=language)
                    text = " ".join(s.text for s in segments)
                    return {"text": text.strip(), "language": info.language, "confidence": 0.9, "engine": "faster_whisper"}
                elif self._engine == "whisper":
                    import whisper
                    model = whisper.load_model("base")
                    result = model.transcribe(tmp_path, language=language)
                    return {"text": result["text"].strip(), "language": result.get("language", language), "confidence": 0.9, "engine": "whisper"}
            finally:
                os.unlink(tmp_path)
        except Exception as exc:
            return {"error": str(exc), "text": ""}

    def status(self) -> Dict[str, Any]:
        return {"available": self._available, "engine": self._engine}


class TTSService:
    """Text to Speech service using edge-tts."""

    DEFAULT_VOICE = "pt-BR-FranciscaNeural"

    def __init__(self):
        self._available = False
        try:
            import importlib
            if importlib.util.find_spec("edge_tts"):
                self._available = True
        except Exception:
            pass

    @property
    def available(self) -> bool:
        return self._available

    async def synthesize(self, text: str, voice: Optional[str] = None) -> bytes:
        if not self._available:
            return b""
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, voice or self.DEFAULT_VOICE)
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
        except Exception as exc:
            logger.warning("[TTS] Synthesis failed: %s", exc)
            return b""

    async def list_voices(self) -> List[Dict[str, Any]]:
        if not self._available:
            return []
        try:
            import edge_tts
            voices = await edge_tts.list_voices()
            return [{"name": v["ShortName"], "gender": v.get("Gender", ""), "locale": v.get("Locale", "")}
                    for v in voices if v.get("Locale", "").startswith("pt-BR")]
        except Exception:
            return [{"name": self.DEFAULT_VOICE, "gender": "Female", "locale": "pt-BR"}]

    def status(self) -> Dict[str, Any]:
        return {"available": self._available, "default_voice": self.DEFAULT_VOICE}
