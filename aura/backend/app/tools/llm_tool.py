from typing import Iterable

from app.models.chat_models import ChatHistoryItem
from app.services.ollama_service import OllamaService


class LLMTool:
    def __init__(self, ollama_service: OllamaService):
        self.ollama_service = ollama_service

    async def chat(self, message: str, history: Iterable[ChatHistoryItem]):
        return await self.ollama_service.generate_response(message=message, history=history)

    async def summarize_text(self, text: str):
        prompt = f"Resuma o conteúdo a seguir de forma objetiva e operacional:\n\n{text}"
        return await self.ollama_service.generate_response(message=prompt, history=[])

    async def analyze_logs(self, text: str):
        prompt = f"Analise os logs abaixo, identifique causa provável e próximos passos seguros:\n\n{text}"
        return await self.ollama_service.generate_response(message=prompt, history=[])

    async def generate_plan(self, goal: str):
        prompt = f"Gere um plano curto e seguro para atingir a meta: {goal}"
        return await self.ollama_service.generate_response(message=prompt, history=[])
