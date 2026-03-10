from app.aura_os.config.models import VoiceStatus
from app.aura_os.voice.stt import SpeechToTextEngine
from app.aura_os.voice.tts import TextToSpeechEngine
from app.aura_os.voice.wake_word import WakeWordEngine


class VoicePipeline:
    def __init__(self):
        self.stt = SpeechToTextEngine()
        self.tts = TextToSpeechEngine()
        self.wake_word = WakeWordEngine()

    def status(self) -> VoiceStatus:
        notes = []
        notes.extend(self.stt.notes())
        notes.extend(self.tts.notes())
        notes.extend(self.wake_word.notes())
        return VoiceStatus(
            stt_ready=self.stt.ready(),
            tts_ready=self.tts.ready(),
            wake_word=self.wake_word.wake_word,
            pipeline_ready=self.stt.ready() and self.tts.ready() and self.wake_word.ready(),
            notes=notes,
        )
