from typing import Dict, List


class ModelRouter:
    def __init__(self, default_model: str):
        self.default_model = default_model
        self.available_models = ["qwen3.5:9b", "llama3", "mistral", "qwen2.5"]

    def route(self, task_type: str) -> Dict[str, object]:
        if task_type in {"developer", "reasoning"}:
            model = "qwen3.5:9b"
        elif task_type in {"summarize", "chat"}:
            model = self.default_model
        else:
            model = self.default_model
        return {"selected_model": model, "candidates": self.available_models}

    def overview(self) -> Dict[str, List[str]]:
        return {"available_models": self.available_models, "default_model": self.default_model}
