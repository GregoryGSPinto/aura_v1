"""
AURA Doc Tool — Read and search documents/code files.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.tools.base import RiskLevel, ToolResult, ToolStatus


# Extensions supported for reading
_TEXT_EXTENSIONS = {
    ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".py", ".js", ".ts", ".tsx", ".jsx", ".css", ".scss", ".html", ".xml",
    ".sh", ".bash", ".zsh", ".fish",
    ".sql", ".graphql", ".proto",
    ".env.example", ".gitignore", ".dockerignore",
    ".rs", ".go", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".lua", ".r", ".m",
    ".csv", ".log",
    ".dockerfile",
}

MAX_READ_SIZE = 1_048_576  # 1 MB


class DocTool:
    """Read and search text/code documents within allowed directories."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.allowed_roots = [Path(p).expanduser().resolve() for p in settings.allowed_roots]

    def _validate_path(self, raw_path: str) -> Path:
        target = Path(raw_path).expanduser().resolve()
        for root in self.allowed_roots:
            if target == root or root in target.parents:
                return target
        raise PermissionError(f"Path '{target}' is outside allowed roots")

    def _is_readable(self, path: Path) -> bool:
        suffix = path.suffix.lower()
        name = path.name.lower()
        if suffix in _TEXT_EXTENSIONS:
            return True
        if name in {"Makefile", "Dockerfile", "Procfile", "Gemfile", "Rakefile", ".env.example"}:
            return True
        if name.startswith(".") and path.stat().st_size < MAX_READ_SIZE:
            # Try reading dotfiles (they're often config)
            return True
        return False

    def read_doc(self, path: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._validate_path(path)
            if not target.is_file():
                return ToolResult.fail("doc.read_doc", f"File not found: {path}")
            size = target.stat().st_size
            if size > MAX_READ_SIZE:
                return ToolResult.fail("doc.read_doc", f"File too large: {size} bytes (max {MAX_READ_SIZE})")
            if not self._is_readable(target):
                return ToolResult.fail("doc.read_doc", f"Unsupported file type: {target.suffix}")
            content = target.read_text(encoding="utf-8", errors="ignore")
            return ToolResult(
                tool_name="doc.read_doc",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=content,
                risk_level=RiskLevel.FREE,
                metadata={"path": str(target), "size": size, "lines": content.count("\n") + 1},
            )
        except PermissionError as exc:
            return ToolResult.blocked("doc.read_doc", str(exc))
        except Exception as exc:
            return ToolResult.fail("doc.read_doc", str(exc))

    def search_in_doc(self, path: str, query: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._validate_path(path)
            if not target.is_file():
                return ToolResult.fail("doc.search_in_doc", f"File not found: {path}")
            content = target.read_text(encoding="utf-8", errors="ignore")
            query_lower = query.lower()
            matches: List[Dict[str, object]] = []
            for line_num, line in enumerate(content.splitlines(), start=1):
                if query_lower in line.lower():
                    matches.append({"line": line_num, "text": line.strip()[:200]})
                    if len(matches) >= 50:
                        break
            return ToolResult(
                tool_name="doc.search_in_doc",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=matches,
                risk_level=RiskLevel.FREE,
                metadata={"path": str(target), "query": query, "match_count": len(matches)},
            )
        except PermissionError as exc:
            return ToolResult.blocked("doc.search_in_doc", str(exc))
        except Exception as exc:
            return ToolResult.fail("doc.search_in_doc", str(exc))

    def file_info(self, path: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._validate_path(path)
            if not target.exists():
                return ToolResult.fail("doc.file_info", f"Path not found: {path}")
            stat = target.stat()
            info = {
                "path": str(target),
                "name": target.name,
                "type": "directory" if target.is_dir() else "file",
                "size": stat.st_size,
                "extension": target.suffix,
                "readable": self._is_readable(target) if target.is_file() else False,
            }
            return ToolResult.quick("doc.file_info", info)
        except PermissionError as exc:
            return ToolResult.blocked("doc.file_info", str(exc))
        except Exception as exc:
            return ToolResult.fail("doc.file_info", str(exc))
