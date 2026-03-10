from typing import Dict, Optional

from app.aura_os.config.models import AuraOSExecutionRequest


class VoiceBridge:
    def __init__(self, wake_detector, stt_engine, tts_engine, aura_os):
        self.wake_detector = wake_detector
        self.stt_engine = stt_engine
        self.tts_engine = tts_engine
        self.aura_os = aura_os

    def process_audio(self, audio: bytes, metadata: Optional[Dict[str, str]] = None, speak: bool = False) -> Dict[str, object]:
        metadata = metadata or {}
        transcript = self.stt_engine.transcribe(audio, metadata)
        wake_detected = self.wake_detector.detect_text(transcript)
        if not wake_detected:
            return {
                "activated": False,
                "transcript": transcript,
                "reason": "wake_word_not_detected",
            }

        cleaned = transcript.replace(self.wake_detector.wake_word, "", 1).strip(" ,:-") or transcript
        result = self.aura_os.execute(
            AuraOSExecutionRequest(goal=cleaned, auto_start=False, actor_id="voice-runtime")
        )
        tts_result = None
        if speak:
            spoken_text = f"Aura pronta. Meta recebida: {cleaned}. Status do plano: {result.plan_status}."
            tts_result = self.tts_engine.speak(spoken_text)

        return {
            "activated": True,
            "transcript": transcript,
            "goal": cleaned,
            "result": result.model_dump(),
            "tts": tts_result,
        }
