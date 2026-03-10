from typing import Dict, List
from urllib.parse import quote_plus

import httpx


class SearchEngine:
    def __init__(self):
        self.base_url = "https://duckduckgo.com/html/"

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, str]]:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(self.base_url, params={"q": query})
            response.raise_for_status()
            html = response.text

        results: List[Dict[str, str]] = []
        chunks = html.split('result__a')
        for chunk in chunks[1:]:
            if len(results) >= limit:
                break
            href_start = chunk.find('href="')
            if href_start == -1:
                continue
            href_start += len('href="')
            href_end = chunk.find('"', href_start)
            url = chunk[href_start:href_end]
            title_end = chunk.find("</a>", href_end)
            title_raw = chunk[href_end:title_end]
            title = (
                title_raw.replace(">", " ").replace("\n", " ").replace("\r", " ").strip()[:180]
                or query
            )
            results.append({"title": title, "url": url, "query": quote_plus(query)})
        return results
