# AURA Architecture

## Vision

Aura evolui de um assistente operacional local-first para um **Personal AI Operating System** com loop de agente:

`perceive -> reason -> plan -> act -> learn`

## Current runtime

- Frontend: Next.js / TypeScript / Tailwind
- Backend: FastAPI
- LLM local: Ollama
- Agent jobs: planner + job manager + step executor
- Computer control: tools seguras e command service com allowlist

## AI OS modules

The new modular runtime lives in [`aura/backend/app/aura_os`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os):

- `core/`
  - `cognition.py`
  - `agent_loop.py`
  - `agent.py`: orchestration loop
  - `reasoner.py`: intent classification
  - `planner.py`: adapter to the existing planner
  - `router.py`: route selection to safe tools
  - `tool_executor.py`: controlled tool execution
- `memory/`
  - `short_term.py`
  - `long_term.py`
  - `vector_store.py`
  - `manager.py`
- `agents/`
  - `system_agent.py`
  - `developer_agent.py`
  - `research_agent.py`
  - `automation_agent.py`
  - `router.py`
- `voice/`
  - `stt.py`
  - `tts.py`
  - `wake_word.py`
  - `pipeline.py`
- `automation/`
  - `actions.py`
  - `workflows.py`
  - `scheduler.py`
- `tools/`
  - `registry.py`
  - `permissions.py`
- `integrations/`
  - `ollama.py`
  - `openai.py`
  - `anthropic.py`
  - `model_router.py`
- `config/`
  - `models.py`
  - `settings.py`

## Backend layering

- Existing app services remain the operational source of truth.
- `aura_os` composes those services instead of replacing them.
- Existing endpoints keep working.
- New runtime endpoints expose AI OS capabilities without breaking the current API.

## New endpoints

- `GET /api/v1/os/overview`
- `POST /api/v1/os/agent/execute`
- `GET /api/v1/os/agents`

## Safety

- No arbitrary shell from user prompts
- Command allowlist remains enforced by `CommandService` and `TerminalTool`
- Voice pipeline is prepared, not enabled by default
- Local-first execution remains on the user machine
