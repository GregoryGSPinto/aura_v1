# Research Runtime v1

## Flow

`query -> search -> scrape -> summarize -> response`

## Modules

- [`aura/backend/app/aura_os/tools/research/search_engine.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/research/search_engine.py)
- [`aura/backend/app/aura_os/tools/research/scraper.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/research/scraper.py)
- [`aura/backend/app/aura_os/tools/research/summarizer.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/research/summarizer.py)
- [`aura/backend/app/aura_os/tools/research/research_tool.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/research/research_tool.py)

## Runtime notes

- search: DuckDuckGo HTML endpoint
- scrape: lightweight HTML extraction
- summarize: current default through local Ollama provider
- intended upgrade path: provider-backed search APIs and richer page extraction
