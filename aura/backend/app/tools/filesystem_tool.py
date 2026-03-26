"""
AURA Filesystem Tool — File operations with path traversal protection.
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.core.exceptions import AuraError, CommandBlockedError
from app.tools.base import RiskLevel, ToolResult, ToolStatus


# Extensions blocked from write/create for security
_BLOCKED_WRITE_EXTENSIONS = {".env", ".pem", ".key", ".p12", ".pfx", ".ssh"}
MAX_FILE_READ_SIZE = 1_048_576  # 1 MB
MAX_FILE_WRITE_SIZE = 5_242_880  # 5 MB


class FilesystemTool:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.allowed_roots = [Path(item).expanduser().resolve() for item in settings.allowed_roots]
        self.max_file_read_size = settings.max_file_read_size

    def _resolve_allowed_path(self, raw_path: Optional[str] = None) -> Path:
        target = Path(raw_path).expanduser().resolve() if raw_path else Path.cwd().resolve()
        for root in self.allowed_roots:
            if target == root or root in target.parents:
                return target
        raise CommandBlockedError(
            "Acesso fora das pastas autorizadas pela Aura.",
            details={"path": str(target), "allowed_roots": [str(root) for root in self.allowed_roots]},
        )

    def ensure_allowed_path(self, raw_path: Optional[str] = None) -> str:
        return str(self._resolve_allowed_path(raw_path))

    # ── Original read-only operations ────────────────────────────

    def list_directory(self, path: Optional[str] = None) -> List[Dict[str, object]]:
        target = self._resolve_allowed_path(path)
        if not target.exists():
            raise AuraError("path_not_found", "O caminho solicitado não existe.", status_code=404)
        if not target.is_dir():
            raise AuraError("path_not_directory", "O caminho solicitado não é um diretório.", status_code=400)
        entries: List[Dict[str, object]] = []
        for entry in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))[:200]:
            stat = entry.stat()
            entries.append(
                {
                    "name": entry.name,
                    "path": str(entry),
                    "type": "directory" if entry.is_dir() else "file",
                    "size": stat.st_size,
                }
            )
        return entries

    def read_file(self, path: str) -> Dict[str, object]:
        target = self._resolve_allowed_path(path)
        if not target.is_file():
            raise AuraError("file_not_found", "Arquivo não encontrado.", status_code=404)
        size = target.stat().st_size
        if size > self.max_file_read_size:
            raise AuraError(
                "file_too_large",
                "Arquivo excede o limite seguro de leitura.",
                details={"size": size, "max_size": self.max_file_read_size},
                status_code=413,
            )
        content = target.read_text(encoding="utf-8", errors="ignore")
        return {"path": str(target), "content": content, "size": size}

    def find_files(self, query: str, root: Optional[str] = None) -> List[Dict[str, object]]:
        base = self._resolve_allowed_path(root)
        query_lower = query.lower()
        matches: List[Dict[str, object]] = []
        for entry in base.rglob("*"):
            if len(matches) >= 50:
                break
            if query_lower in entry.name.lower():
                matches.append(
                    {
                        "name": entry.name,
                        "path": str(entry),
                        "type": "directory" if entry.is_dir() else "file",
                    }
                )
        return matches

    def search_text(self, query: str, root: Optional[str] = None) -> List[Dict[str, object]]:
        base = self._resolve_allowed_path(root)
        results: List[Dict[str, object]] = []
        for entry in base.rglob("*"):
            if len(results) >= 50:
                break
            if not entry.is_file():
                continue
            try:
                if entry.stat().st_size > self.max_file_read_size:
                    continue
                content = entry.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            if query.lower() in content.lower():
                results.append({"path": str(entry), "match": query})
        return results

    # ── New write operations (Sprint 4) ──────────────────────────

    def write_file(self, path: str, content: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._resolve_allowed_path(path)
            if target.suffix.lower() in _BLOCKED_WRITE_EXTENSIONS:
                return ToolResult.blocked(
                    "filesystem.write_file",
                    f"Writing to {target.suffix} files is blocked for security",
                )
            content_size = len(content.encode("utf-8"))
            if content_size > MAX_FILE_WRITE_SIZE:
                return ToolResult.fail(
                    "filesystem.write_file",
                    f"Content too large: {content_size} bytes (max {MAX_FILE_WRITE_SIZE})",
                )
            # Create parent dirs if needed
            target.parent.mkdir(parents=True, exist_ok=True)
            existed = target.exists()
            target.write_text(content, encoding="utf-8")
            return ToolResult(
                tool_name="filesystem.write_file",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=f"{'Updated' if existed else 'Created'}: {target}",
                risk_level=RiskLevel.CONFIRM,
                metadata={"path": str(target), "size": content_size, "existed": existed},
            )
        except CommandBlockedError as exc:
            return ToolResult.blocked("filesystem.write_file", str(exc))
        except Exception as exc:
            return ToolResult.fail("filesystem.write_file", str(exc))

    def delete_file(self, path: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._resolve_allowed_path(path)
            if not target.exists():
                return ToolResult.fail("filesystem.delete_file", f"Not found: {path}")
            if target.is_dir():
                return ToolResult.blocked(
                    "filesystem.delete_file",
                    "Deleting directories is not allowed. Use terminal for that.",
                )
            size = target.stat().st_size
            target.unlink()
            return ToolResult(
                tool_name="filesystem.delete_file",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=f"Deleted: {target}",
                risk_level=RiskLevel.CRITICAL,
                metadata={"path": str(target), "size": size},
            )
        except CommandBlockedError as exc:
            return ToolResult.blocked("filesystem.delete_file", str(exc))
        except Exception as exc:
            return ToolResult.fail("filesystem.delete_file", str(exc))

    def move_file(self, src: str, dst: str) -> ToolResult:
        t0 = time.time()
        try:
            src_path = self._resolve_allowed_path(src)
            dst_path = self._resolve_allowed_path(dst)
            if not src_path.exists():
                return ToolResult.fail("filesystem.move_file", f"Source not found: {src}")
            shutil.move(str(src_path), str(dst_path))
            return ToolResult(
                tool_name="filesystem.move_file",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=f"Moved: {src_path} → {dst_path}",
                risk_level=RiskLevel.CONFIRM,
                metadata={"src": str(src_path), "dst": str(dst_path)},
            )
        except CommandBlockedError as exc:
            return ToolResult.blocked("filesystem.move_file", str(exc))
        except Exception as exc:
            return ToolResult.fail("filesystem.move_file", str(exc))

    def create_dir(self, path: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._resolve_allowed_path(path)
            existed = target.exists()
            target.mkdir(parents=True, exist_ok=True)
            return ToolResult(
                tool_name="filesystem.create_dir",
                status=ToolStatus.SUCCESS,
                started_at=t0,
                finished_at=time.time(),
                output=f"{'Already exists' if existed else 'Created'}: {target}",
                risk_level=RiskLevel.CONFIRM,
                metadata={"path": str(target), "existed": existed},
            )
        except CommandBlockedError as exc:
            return ToolResult.blocked("filesystem.create_dir", str(exc))
        except Exception as exc:
            return ToolResult.fail("filesystem.create_dir", str(exc))

    def file_info(self, path: str) -> ToolResult:
        t0 = time.time()
        try:
            target = self._resolve_allowed_path(path)
            if not target.exists():
                return ToolResult.fail("filesystem.file_info", f"Not found: {path}")
            stat = target.stat()
            return ToolResult.quick(
                "filesystem.file_info",
                {
                    "path": str(target),
                    "name": target.name,
                    "type": "directory" if target.is_dir() else "file",
                    "size": stat.st_size,
                    "extension": target.suffix,
                },
            )
        except CommandBlockedError as exc:
            return ToolResult.blocked("filesystem.file_info", str(exc))
        except Exception as exc:
            return ToolResult.fail("filesystem.file_info", str(exc))
