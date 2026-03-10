class WakeWordEngine:
    def __init__(self, wake_word: str = "Aura"):
        self.wake_word = wake_word

    def ready(self) -> bool:
        return False

    def notes(self):
        return [f"Wake word '{self.wake_word}' preparada para futura ativação local."]
