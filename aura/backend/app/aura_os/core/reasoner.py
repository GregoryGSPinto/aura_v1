from typing import Dict


class Reasoner:
    def analyze(self, goal: str) -> Dict[str, str]:
        lowered = goal.lower()
        if any(term in lowered for term in ["debug", "erro", "falha", "analisar código", "analyze repo"]):
            intent = "developer"
        elif any(term in lowered for term in ["ouvir", "voz", "microfone", "wake word"]):
            intent = "voice"
        elif any(term in lowered for term in ["git", "build", "lint", "test", "deploy"]):
            intent = "developer"
        elif any(term in lowered for term in ["cpu", "memória", "memoria", "disco", "sistema", "terminal", "vscode"]):
            intent = "system"
        else:
            intent = "assistant"

        return {
            "intent": intent,
            "reasoning": f"Objetivo classificado como '{intent}' a partir das palavras-chave principais.",
        }
