from app.aura_os.tools.research.research_tool import ResearchTool


class DummySearch:
    async def search(self, query: str, limit: int = 3):
        return [{"title": "Result", "url": "https://example.com", "query": query}]


class DummyScraper:
    async def scrape(self, url: str):
        return {"url": url, "content": "AI regulation in Brazil is evolving quickly."}


class DummySummarizer:
    async def summarize(self, query: str, pages):
        return {"summary": f"Resumo para {query}", "sources": [page["url"] for page in pages]}


import pytest


@pytest.mark.anyio
async def test_research_tool_returns_summary():
    tool = ResearchTool(DummySearch(), DummyScraper(), DummySummarizer())
    result = await tool.research("latest AI regulation Brazil")
    assert result["summary"].startswith("Resumo para")
    assert result["sources"] == ["https://example.com"]
