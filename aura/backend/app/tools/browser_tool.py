import subprocess
from urllib.parse import urlparse

from app.core.exceptions import AuraError


class BrowserTool:
    def open_url(self, url: str) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise AuraError("invalid_url_scheme", "A Aura permite apenas URLs http/https.", status_code=400)
        subprocess.Popen(["open", url])
        return {"opened": True, "url": url, "message": f"URL aberta no navegador: {url}"}
