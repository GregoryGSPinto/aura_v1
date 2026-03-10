from typing import Dict, List


class ResearchSummarizer:
    def __init__(self, provider):
        self.provider = provider

    async def summarize(self, query: str, pages: List[Dict[str, str]]) -> Dict[str, str]:
        joined = "\n\n".join(
            f"Fonte: {page.get('url', '')}\nConteudo: {page.get('content', '')[:1800]}" for page in pages
        )
        prompt = (
            "Resuma em português do Brasil as descobertas mais importantes para a pesquisa abaixo.\n"
            f"Consulta: {query}\n\n{joined}\n\nResumo:"
        )
        summary = await self.provider.generate(prompt, task_type="research")
        return {"summary": summary, "sources": [page.get("url", "") for page in pages]}
