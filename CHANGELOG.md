# Changelog

## 1.0.0 - 2026-03-10

- introduced Aura AI Operating System modular runtime
- added `aura_os` package with agent loop, memory, tools registry, integrations, and voice pipeline scaffolding
- preserved existing FastAPI + Ollama + local computer control architecture
- added `GET /api/v1/os/overview`
- added `POST /api/v1/os/agent/execute`
- added initial backend tests for runtime, memory, and tool registry
- added GitHub Actions CI for backend and frontend
