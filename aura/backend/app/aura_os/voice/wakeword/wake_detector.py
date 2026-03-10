from typing import Dict


class WakeDetector:
    def __init__(self, wake_word: str = "Aura"):
        self.wake_word = wake_word

    def detect_text(self, text: str) -> bool:
        return self.wake_word.lower() in text.lower()

    def analyze_chunk(self, metadata: Dict[str, str]) -> bool:
        transcript_hint = metadata.get("transcript_hint", "")
        return self.detect_text(transcript_hint)

    def status(self) -> Dict[str, object]:
        return {
            "wake_word": self.wake_word,
            "engine": "text-fallback-ready",
            "ready": True,
        }
