from typing import Dict, Optional

from app.aura_os.config.models import VoiceStatus
from app.aura_os.voice.audio_engine import MicrophoneStream
from app.aura_os.voice.stt import WhisperEngine
from app.aura_os.voice.tts import TTSEngine
from app.aura_os.voice.voice_bridge import VoiceBridge
from app.aura_os.voice.wakeword import WakeDetector


class VoicePipeline:
    def __init__(self, aura_os=None):
        self.microphone = MicrophoneStream()
        self.stt = WhisperEngine()
        self.tts = TTSEngine()
        self.wake_word = WakeDetector()
        self.bridge: Optional[VoiceBridge] = VoiceBridge(self.wake_word, self.stt, self.tts, aura_os) if aura_os else None

    def attach_runtime(self, aura_os) -> None:
        self.bridge = VoiceBridge(self.wake_word, self.stt, self.tts, aura_os)

    def process_once(self, transcript_hint: str, speak: bool = False) -> Dict[str, object]:
        if not self.bridge:
            return {"activated": False, "reason": "voice_bridge_not_attached"}
        return self.bridge.process_audio(transcript_hint.encode("utf-8"), {"transcript_hint": transcript_hint}, speak=speak)

    def status(self) -> VoiceStatus:
        notes = []
        notes.extend(self.stt.notes())
        notes.extend(self.tts.notes())
        notes.append(f"Wake detector pronto para '{self.wake_word.wake_word}'.")
        return VoiceStatus(
            stt_ready=self.stt.ready(),
            tts_ready=self.tts.ready(),
            wake_word=self.wake_word.wake_word,
            pipeline_ready=self.stt.ready() and self.tts.ready(),
            notes=notes,
        )
