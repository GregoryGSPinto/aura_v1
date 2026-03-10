import subprocess


class BrowserTool:
    def open_url(self, url: str) -> dict:
        subprocess.Popen(["open", url])
        return {"opened": True, "url": url, "message": f"URL aberta no navegador: {url}"}
