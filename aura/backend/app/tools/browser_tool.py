"""
AURA Browser Tool — URL fetching, checking, and text extraction.
"""

from __future__ import annotations

import re
import subprocess
import time
from html.parser import HTMLParser
from typing import List, Optional
from urllib.parse import urlparse

import httpx

from app.core.exceptions import AuraError
from app.tools.base import RiskLevel, ToolResult, ToolStatus


MAX_RESPONSE_SIZE = 2 * 1024 * 1024  # 2 MB
FETCH_TIMEOUT = 15.0

# Internal/private ranges we block for SSRF protection
_BLOCKED_HOST_PATTERNS = [
    r"^10\.",
    r"^172\.(1[6-9]|2\d|3[01])\.",
    r"^192\.168\.",
    r"^0\.",
    r"^169\.254\.",
    r"^fc00:",
    r"^fd",
]


def _is_blocked_host(host: str) -> bool:
    """Block internal/private IPs but allow localhost for dev."""
    if not host:
        return True
    for pattern in _BLOCKED_HOST_PATTERNS:
        if re.match(pattern, host):
            return True
    return False


def _validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are allowed")
    host = parsed.hostname or ""
    if _is_blocked_host(host):
        raise ValueError(f"Blocked host: {host}")
    return url


class _TextExtractor(HTMLParser):
    """Simple HTML parser that extracts visible text."""

    def __init__(self):
        super().__init__()
        self._text: List[str] = []
        self._skip = False
        self._skip_tags = {"script", "style", "noscript", "svg", "head"}

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() in self._skip_tags:
            self._skip = True

    def handle_endtag(self, tag: str):
        if tag.lower() in self._skip_tags:
            self._skip = False

    def handle_data(self, data: str):
        if not self._skip:
            text = data.strip()
            if text:
                self._text.append(text)

    def get_text(self) -> str:
        return "\n".join(self._text)


class BrowserTool:
    """URL operations: open, fetch, check, extract text."""

    def open_url(self, url: str) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise AuraError("invalid_url_scheme", "A Aura permite apenas URLs http/https.", status_code=400)
        subprocess.Popen(["open", url])
        return {"opened": True, "url": url, "message": f"URL aberta no navegador: {url}"}

    async def fetch_url(self, url: str) -> ToolResult:
        t0 = time.time()
        try:
            url = _validate_url(url)
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Aura/1.0"})
                content_type = resp.headers.get("content-type", "")
                size = len(resp.content)
                if size > MAX_RESPONSE_SIZE:
                    return ToolResult(
                        tool_name="browser.fetch_url",
                        status=ToolStatus.FAILED,
                        started_at=t0,
                        finished_at=time.time(),
                        error=f"Response too large: {size} bytes (max {MAX_RESPONSE_SIZE})",
                        risk_level=RiskLevel.FREE,
                    )
                # JSON response
                if "json" in content_type:
                    body = resp.json()
                else:
                    body = resp.text[:50000]  # Cap text at 50k chars
                return ToolResult(
                    tool_name="browser.fetch_url",
                    status=ToolStatus.SUCCESS,
                    started_at=t0,
                    finished_at=time.time(),
                    output=body,
                    risk_level=RiskLevel.FREE,
                    metadata={
                        "url": url,
                        "status_code": resp.status_code,
                        "content_type": content_type,
                        "size": size,
                    },
                )
        except ValueError as exc:
            return ToolResult.blocked("browser.fetch_url", str(exc))
        except Exception as exc:
            return ToolResult(
                tool_name="browser.fetch_url",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.FREE,
            )

    async def check_url(self, url: str) -> ToolResult:
        t0 = time.time()
        try:
            url = _validate_url(url)
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
                resp = await client.head(url, headers={"User-Agent": "Aura/1.0"})
                return ToolResult(
                    tool_name="browser.check_url",
                    status=ToolStatus.SUCCESS,
                    started_at=t0,
                    finished_at=time.time(),
                    output={
                        "url": url,
                        "reachable": True,
                        "status_code": resp.status_code,
                        "content_type": resp.headers.get("content-type", ""),
                    },
                    risk_level=RiskLevel.FREE,
                )
        except ValueError as exc:
            return ToolResult.blocked("browser.check_url", str(exc))
        except Exception as exc:
            return ToolResult(
                tool_name="browser.check_url",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output={"url": url, "reachable": False, "error": str(exc)},
                risk_level=RiskLevel.FREE,
            )

    async def extract_text(self, url: str) -> ToolResult:
        t0 = time.time()
        try:
            url = _validate_url(url)
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Aura/1.0"})
                resp.raise_for_status()
                html = resp.text[:MAX_RESPONSE_SIZE]
                extractor = _TextExtractor()
                extractor.feed(html)
                text = extractor.get_text()[:10000]  # Cap at 10k chars
                return ToolResult(
                    tool_name="browser.extract_text",
                    status=ToolStatus.SUCCESS,
                    started_at=t0,
                    finished_at=time.time(),
                    output=text,
                    risk_level=RiskLevel.FREE,
                    metadata={"url": url, "chars": len(text)},
                )
        except ValueError as exc:
            return ToolResult.blocked("browser.extract_text", str(exc))
        except Exception as exc:
            return ToolResult(
                tool_name="browser.extract_text",
                status=ToolStatus.FAILED,
                started_at=t0,
                finished_at=time.time(),
                error=str(exc),
                risk_level=RiskLevel.FREE,
            )
