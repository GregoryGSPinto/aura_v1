class SpeechToTextEngine:
    provider_name = "whisper"

    def ready(self) -> bool:
        return False

    def notes(self):
        return ["Pipeline de STT preparado para Whisper, ainda não configurado nesta instalação."]
