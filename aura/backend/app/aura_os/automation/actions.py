from typing import Dict, List


class ActionRegistry:
    def list_actions(self) -> List[Dict[str, str]]:
        return [
            {"name": "notify_user", "description": "Notifica o usuário na interface da Aura."},
            {"name": "run_safe_command", "description": "Dispara uma ação segura registrada no runtime."},
            {"name": "summarize_state", "description": "Gera um resumo operacional para revisão posterior."},
        ]
