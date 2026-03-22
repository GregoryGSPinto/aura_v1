"""
Tool Call Parser — Extrai tool calls da resposta do LLM.
"""

import json
import re
import logging
from typing import Optional

logger = logging.getLogger("aura")


class ToolCallParser:

    TOOL_CALL_PATTERNS = [
        r'```tool_call\s*\n(.*?)\n```',
        r'```json\s*\n(\{[^`]*?"tool"[^`]*?\})\n```',
        r'(\{"tool"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{.*?\}\})',
    ]

    def parse(self, llm_response: str) -> Optional[dict]:
        if not llm_response:
            return None
        for pattern in self.TOOL_CALL_PATTERNS:
            match = re.search(pattern, llm_response, re.DOTALL)
            if match:
                try:
                    json_str = match.group(1).strip()
                    tool_call = json.loads(json_str)
                    if "tool" not in tool_call:
                        continue
                    raw_text = llm_response[:match.start()].strip()
                    after_text = llm_response[match.end():].strip()
                    if after_text:
                        raw_text = f"{raw_text}\n{after_text}".strip()
                    return {
                        "tool": tool_call["tool"],
                        "params": tool_call.get("params", tool_call.get("parameters", {})),
                        "reason": tool_call.get("reason", ""),
                        "raw_text": raw_text,
                    }
                except (json.JSONDecodeError, KeyError) as exc:
                    logger.warning("[ToolCallParser] Failed to parse: %s", exc)
                    continue
        return None

    def extract_text_without_tool_call(self, llm_response: str) -> str:
        for pattern in self.TOOL_CALL_PATTERNS:
            llm_response = re.sub(pattern, "", llm_response, flags=re.DOTALL)
        return llm_response.strip()
