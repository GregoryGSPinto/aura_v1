from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import Settings
from app.core.exceptions import AuraError, CommandBlockedError


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
