from typing import Dict, List

from app.core.exceptions import ExternalServiceError


class ResearchTool:
    def __init__(self, search_engine, scraper, summarizer):
        self.search_engine = search_engine
        self.scraper = scraper
        self.summarizer = summarizer

    async def research(self, query: str, limit: int = 3) -> Dict[str, object]:
        results = await self.search_engine.search(query, limit=limit)
        if not results:
            raise ExternalServiceError("Nenhum resultado encontrado para a pesquisa solicitada.")

        pages: List[Dict[str, str]] = []
        for result in results[:limit]:
            try:
                pages.append(await self.scraper.scrape(result["url"]))
            except Exception:
                continue

        if not pages:
            raise ExternalServiceError("Nenhuma página pôde ser processada na pesquisa.")

        summary = await self.summarizer.summarize(query, pages)
        return {
            "query": query,
            "results": results,
            "pages": pages,
            "summary": summary["summary"],
            "sources": summary["sources"],
        }
