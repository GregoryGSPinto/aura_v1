class TextToSpeechEngine:
    provider_name = "coqui"

    def ready(self) -> bool:
        return False

    def notes(self):
        return ["Pipeline de TTS preparado para Coqui, ainda não configurado nesta instalação."]
