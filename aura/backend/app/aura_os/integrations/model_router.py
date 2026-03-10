from typing import Dict, List


class ModelRouter:
    def __init__(self, default_model: str, config: Dict[str, object]):
        self.default_model = default_model
        self.config = config
        self.available_models = ["qwen3.5:9b", "llama3", "mistral", "qwen2.5"]

    def route(self, task_type: str) -> Dict[str, object]:
        if task_type in {"developer", "coding", "reasoning"}:
            provider = str(self.config.get("coding_model", "anthropic"))
            model = "qwen3.5:9b" if provider == "ollama" else provider
        elif task_type in {"research", "summarize"}:
            provider = str(self.config.get("research_model", "openai"))
            model = self.default_model if provider == "ollama" else provider
        elif task_type in {"local", "system"}:
            provider = str(self.config.get("local_model", "ollama"))
            model = self.default_model if provider == "ollama" else provider
        else:
            provider = str(self.config.get("conversation_model", self.config.get("default_model", "openai")))
            model = self.default_model if provider == "ollama" else provider
        return {"provider": provider, "selected_model": model, "candidates": self.available_models, "task_type": task_type}

    def overview(self) -> Dict[str, List[str]]:
        return {
            "available_models": self.available_models,
            "default_model": self.default_model,
            "routing": self.config,
        }
