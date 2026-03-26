"""
Sprint 9 — Docs + Calendar + Email services.

Wraps Google Calendar, Gmail, and local doc reading/summarization.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


# ── Calendar Service ────────────────────────────────────────────


class CalendarService:
    """Google Calendar operations (via existing connector or API)."""

    def __init__(self, calendar_connector=None, ollama_service=None):
        self.connector = calendar_connector
        self.ollama = ollama_service
        self.available = bool(calendar_connector and hasattr(calendar_connector, 'api_key') and calendar_connector.api_key)

    async def get_today_events(self) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "Calendar not configured. Set GOOGLE_CALENDAR_API_KEY in .env"}]
        try:
            if hasattr(self.connector, 'get_today_events'):
                return await self.connector.get_today_events()
            return [{"info": "Calendar connector available but no events method"}]
        except Exception as exc:
            return [{"error": str(exc)}]

    async def get_week_events(self) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "Calendar not configured"}]
        try:
            if hasattr(self.connector, 'get_week_events'):
                return await self.connector.get_week_events()
            return []
        except Exception as exc:
            return [{"error": str(exc)}]

    async def get_upcoming(self, hours: int = 4) -> List[Dict[str, Any]]:
        if not self.available:
            return []
        try:
            if hasattr(self.connector, 'get_upcoming'):
                return await self.connector.get_upcoming(hours)
            return await self.get_today_events()
        except Exception:
            return []

    async def get_daily_briefing(self) -> Dict[str, Any]:
        events = await self.get_today_events()
        return {
            "events": events if not any("error" in e for e in events) else [],
            "total": len(events),
            "configured": self.available,
        }


# ── Email Service ───────────────────────────────────────────────


class EmailService:
    """Gmail operations (via existing connector or API)."""

    def __init__(self, gmail_connector=None, ollama_service=None):
        self.connector = gmail_connector
        self.ollama = ollama_service
        self.available = bool(gmail_connector and hasattr(gmail_connector, 'address') and gmail_connector.address)

    async def get_unread(self, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "Gmail not configured. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env"}]
        try:
            if hasattr(self.connector, 'get_unread'):
                return await self.connector.get_unread(limit)
            return [{"info": "Gmail connector available but no unread method"}]
        except Exception as exc:
            return [{"error": str(exc)}]

    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "Gmail not configured"}]
        try:
            if hasattr(self.connector, 'search'):
                return await self.connector.search(query, limit)
            return []
        except Exception as exc:
            return [{"error": str(exc)}]

    async def get_email_briefing(self) -> Dict[str, Any]:
        unread = await self.get_unread(5)
        return {
            "unread": unread if not any("error" in e for e in unread) else [],
            "unread_count": len(unread) if not any("error" in e for e in unread) else 0,
            "configured": self.available,
        }


# ── Doc Service ─────────────────────────────────────────────────


class DocService:
    """Local document reading and summarization."""

    SUPPORTED_EXTENSIONS = {
        ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
        ".toml", ".csv", ".sql", ".sh", ".bash", ".zsh", ".env.example", ".gitignore",
        ".html", ".css", ".scss", ".xml", ".rst", ".cfg", ".ini", ".conf",
    }
    MAX_SIZE = 1_048_576  # 1MB

    def __init__(self, ollama_service=None, allowed_roots: Optional[List[str]] = None):
        self.ollama = ollama_service
        self.allowed_roots = allowed_roots or []

    async def read_file(self, path: str) -> Dict[str, Any]:
        from pathlib import Path as P
        p = P(path).expanduser().resolve()
        if not p.exists():
            return {"error": f"File not found: {path}"}
        if not p.is_file():
            return {"error": f"Not a file: {path}"}
        if p.stat().st_size > self.MAX_SIZE:
            return {"error": f"File too large: {p.stat().st_size} bytes"}
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
            return {"path": str(p), "content": content[:50000], "size": p.stat().st_size, "lines": content.count("\n") + 1}
        except Exception as exc:
            return {"error": str(exc)}

    async def summarize(self, path: str, focus: str = "") -> Dict[str, Any]:
        file_data = await self.read_file(path)
        if "error" in file_data:
            return file_data
        content = file_data["content"][:10000]
        if not self.ollama:
            return {"summary": content[:500], "source": "truncated"}
        prompt = f"Resuma o conteudo deste arquivo de forma executiva (max 5 linhas):\n{'Foco: ' + focus + chr(10) if focus else ''}\n{content}"
        try:
            text, _ = await self.ollama.generate_response(prompt, [], think=False)
            return {"summary": text, "path": path, "source": "ollama"}
        except Exception:
            return {"summary": content[:500], "source": "truncated"}

    async def extract_actions(self, path: str) -> List[str]:
        file_data = await self.read_file(path)
        if "error" in file_data:
            return []
        content = file_data["content"][:10000]
        if not self.ollama:
            return []
        prompt = f"Extraia todas as acoes/tarefas mencionadas neste texto (lista simples):\n{content}"
        try:
            text, _ = await self.ollama.generate_response(prompt, [], think=False)
            lines = [l.strip().lstrip("- ").lstrip("* ") for l in text.splitlines() if l.strip()]
            return lines[:20]
        except Exception:
            return []

    async def search_in_file(self, path: str, query: str) -> List[Dict[str, Any]]:
        file_data = await self.read_file(path)
        if "error" in file_data:
            return []
        content = file_data["content"]
        results = []
        for i, line in enumerate(content.splitlines(), 1):
            if query.lower() in line.lower():
                results.append({"line": i, "content": line.strip()})
        return results[:50]
