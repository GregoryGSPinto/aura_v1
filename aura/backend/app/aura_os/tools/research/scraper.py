import re
from typing import Dict

import httpx


class WebScraper:
    async def scrape(self, url: str) -> Dict[str, str]:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text

        text = re.sub(r"<script.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return {
            "url": url,
            "content": text[:10000],
        }
