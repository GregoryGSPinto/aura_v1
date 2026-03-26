"""
Claude API Client — direct httpx calls to Anthropic Messages API.

Does NOT depend on the existing AnthropicProvider in aura_os.
This is a standalone, lightweight client for the Brain Router.
"""

from typing import Optional

import httpx


class ClaudeClient:
    """Client for Claude API (Anthropic)."""

    BASE_URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str = "", model: str = "claude-sonnet-4-20250514"):  # noqa: E501
        self.api_key = api_key
        self.model = model
        self.available = bool(api_key)

    def _headers(self) -> dict:
        return {
            "x-api-key": self.api_key,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
        }

    async def chat(
        self,
        messages: list,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> dict:
        """
        Send message to Claude API.

        Returns: {"content": str, "model": str, "usage": {...}, "stop_reason": str}
        """
        if not self.available:
            raise RuntimeError("ANTHROPIC_API_KEY nao configurada no .env")

        payload: dict = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "temperature": temperature,
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(self.BASE_URL, headers=self._headers(), json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "content": data["content"][0]["text"],
            "model": data["model"],
            "usage": data.get("usage", {}),
            "stop_reason": data.get("stop_reason"),
        }

    async def chat_with_tools(
        self,
        messages: list,
        tools: list,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> dict:
        """
        Chat with native Claude tool calling.

        Returns: {"text": str, "tool_calls": [...], "model": str, "usage": {...}}
        """
        if not self.available:
            raise RuntimeError("ANTHROPIC_API_KEY nao configurada")

        payload: dict = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "tools": tools,
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(self.BASE_URL, headers=self._headers(), json=payload)
            response.raise_for_status()
            data = response.json()

        text_parts: list = []
        tool_calls: list = []
        for block in data["content"]:
            if block["type"] == "text":
                text_parts.append(block["text"])
            elif block["type"] == "tool_use":
                tool_calls.append(
                    {"id": block["id"], "name": block["name"], "input": block["input"]}
                )

        return {
            "text": "\n".join(text_parts),
            "tool_calls": tool_calls,
            "model": data["model"],
            "usage": data.get("usage", {}),
            "stop_reason": data.get("stop_reason"),
        }

    async def check_health(self) -> dict:
        """Check if the API is accessible."""
        if not self.available:
            return {"status": "not_configured", "action": "Configure ANTHROPIC_API_KEY no .env"}
        try:
            result = await self.chat(
                [{"role": "user", "content": "ping"}], max_tokens=10, temperature=0.0
            )
            return {"status": "online", "model": result["model"]}
        except Exception as e:
            return {"status": "offline", "error": str(e)}
