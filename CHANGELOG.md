# Changelog

## 1.1.0 - 2026-03-10

- implemented Voice Runtime v1 with microphone stream, wake detection, STT bridge, and macOS TTS fallback
- implemented Internet Research Runtime v1 with search, scrape, and summarize flow
- implemented Multi-LLM Router v1 with provider routing and config-based model selection
- added AI OS endpoints for voice, research, model router, and agent listing
- added backend tests for voice runtime, research runtime, and model routing

## 1.0.0 - 2026-03-10

- introduced Aura AI Operating System modular runtime
- added `aura_os` package with agent loop, memory, tools registry, integrations, and voice pipeline scaffolding
- preserved existing FastAPI + Ollama + local computer control architecture
- added `GET /api/v1/os/overview`
- added `POST /api/v1/os/agent/execute`
- added initial backend tests for runtime, memory, and tool registry
- added GitHub Actions CI for backend and frontend
