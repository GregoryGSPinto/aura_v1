from typing import Dict


class CognitionEngine:
    def perceive(self, user_input: str) -> Dict[str, str]:
        return {
            "input": user_input,
            "mode": "conversation" if "?" in user_input else "operation",
        }

    def learn(self, goal: str, status: str) -> Dict[str, str]:
        return {
            "goal": goal,
            "status": status,
            "lesson": "Persistir memória episódica e semântica após cada execução.",
        }
