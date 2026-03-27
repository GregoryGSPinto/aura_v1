# ✦ Aura — Autonomous Personal AI Agent

> Voice-driven AI that controls your Mac so you don't have to.

Aura is a personal AI agent built for one person's real workflow. Send a voice command from your iPhone, and Aura understands it, picks the right tools, executes on macOS, and responds with audio — all through a dual-brain architecture that runs local models for free and routes complex tasks to Claude API.

---

## Demo

Aura is a private project in active daily use. No public demo is available.
Screenshots and video walkthroughs will be added as the project stabilizes.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────────────────────┐
│   iPhone     │────▶│  ngrok       │────▶│  FastAPI Backend (:8000)          │
│   (voice)    │     │  tunnel      │     │                                   │
└─────────────┘     └──────────────┘     │  ┌─────────────┐  ┌───────────┐  │
                                          │  │ Brain Router │  │ Agent     │  │
┌─────────────┐                           │  │ local/cloud  │──│ Service   │  │
│  Next.js     │◀────────────────────────▶│  └──────┬──────┘  └─────┬─────┘  │
│  Frontend    │     WebSocket + REST      │         │               │        │
│  (Vercel)    │                           │    ┌────▼────┐   ┌─────▼──────┐ │
└─────────────┘                           │    │  Qwen    │   │   Tool     │ │
                                          │    │  3.5:9b  │   │  Registry  │ │
                                          │    │ (Ollama) │   │  13 tools  │ │
                                          │    └─────────┘   └────────────┘ │
                                          │    ┌─────────┐                   │
                                          │    │ Claude   │   ┌────────────┐ │
                                          │    │   API    │   │  SQLite    │ │
                                          │    │ (Sonnet) │   │  memory    │ │
                                          │    └─────────┘   └────────────┘ │
                                          └───────────────────────────────────┘
```

---

## Features

Implemented and working (verified via [test suite](#test-results)):

- **Voice commands** — Web Speech API (STT) + edge-tts (TTS), works from iPhone via ngrok
- **13 tools** with real execution — shell, filesystem, git, browser, deploy, and more
- **Dual brain** — Qwen 3.5:9b local (free) for simple tasks, Claude API for complex reasoning
- **Ollama on-demand** — auto-starts when needed, auto-stops after 10 min idle, frees RAM
- **Autonomy levels** — L1 autonomous, L2 needs approval, L3 hardcoded block
- **Browser automation** — AppleScript + DOM extraction (no Playwright, no screenshots)
- **Web workflows** — pre-built templates for GitHub, Vercel, Supabase operations
- **File attachments** — PDF text extraction, ZIP listing, image/text processing
- **Missions engine** — LLM-planned multi-step task execution with SQLite persistence
- **Boot-on-login** — LaunchAgent with idempotent 5-phase boot script
- **Remote access** — ngrok permanent domain with auth middleware
- **Audit trail** — every tool call logged to JSONL with timestamp, params, result
- **Safety layer** — approval queue, rollback registry, dangerous command blocking
- **65 backend tests + 22 E2E tests** passing

---

## Autonomy Levels

| Level | Policy | Examples | Override |
|-------|--------|----------|----------|
| **L1** — Autonomous | Executes without asking | Read files, list directories, git status, search | — |
| **L2** — Approval | Queued for user approval | Write files, deploy, git push, open apps, browser navigation | User approves/rejects |
| **L3** — Blocked | **Never executes** | `rm -rf /`, force push, credential rotation, financial ops | **Hardcoded — not promotable** |

L3 is enforced at the tool level with regex pattern matching. The ShellTool blocks dangerous commands before they reach the OS. There is no configuration or prompt that can elevate an L3 action.

---

## Tool Layer

All 13 tools registered in `create_tool_registry()`:

| Tool | Description | Level | Category |
|------|-------------|-------|----------|
| `shell` | Execute terminal commands (with L3 blocking for dangerous patterns) | Dynamic | System |
| `macos` | Control macOS — open apps, notifications, volume, clipboard, Finder | Dynamic | System |
| `file_read` | Read file contents with optional line range | L1 | Filesystem |
| `file_write` | Create or overwrite files | L2 | Filesystem |
| `file_search` | Search files by name or glob pattern | L1 | Filesystem |
| `file_list` | List directory contents with metadata | L1 | Filesystem |
| `git` | Git operations — status, diff, log, commit, push, branch | Dynamic | Version Control |
| `claude_code` | Delegate complex engineering tasks to Claude Code CLI | L2 | Development |
| `vercel` | Deploy and manage Vercel projects | Dynamic | Deployment |
| `browser` | Control Chrome/Safari via AppleScript — open URLs, read pages | Dynamic | Browser |
| `browser_navigate` | Multi-step site navigation via DOM extraction + LLM reasoning | L2 | Browser |
| `web_workflow` | Pre-built workflows for GitHub, Vercel, Supabase | L2 | Browser |
| `attachment` | Process uploaded files — PDF, text, ZIP, images | L1 | Filesystem |

Tools marked **Dynamic** classify their autonomy at runtime based on the specific operation (e.g., `git status` = L1, `git push` = L2, `git push --force` = L3).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI 0.115, uvicorn, SQLite |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind 3, Zustand 5, Vercel |
| **AI (local)** | Ollama + Qwen 3.5:9b — zero cost, ~3 GB RAM |
| **AI (cloud)** | Claude API (Sonnet) — complex reasoning, native tool calling |
| **Infrastructure** | macOS, LaunchAgent, ngrok (permanent domain) |
| **Voice** | Web Speech API (STT in browser), edge-tts (TTS) |
| **Browser control** | AppleScript + JavaScript injection — DOM extraction, no Playwright |
| **State** | Zustand 5 (frontend, SSR-safe), SQLite (backend memory + audit) |

---

## How It Works

```
1. Voice command from iPhone
   └─▶ Web Speech API transcribes to text

2. Request hits FastAPI via ngrok tunnel
   └─▶ Auth middleware validates bearer token

3. Brain Router classifies complexity
   ├─▶ Simple → Qwen 3.5:9b (local, free, fast)
   └─▶ Complex → Claude API (reasoning, tool calling)

4. Agent Service orchestrates execution
   └─▶ LLM emits <tool_call> tags → parsed → executed (max 10 per message)

5. Tool Registry enforces autonomy
   ├─▶ L1: execute immediately
   ├─▶ L2: queue for approval
   └─▶ L3: block and log

6. Response returned with TTS audio
   └─▶ Every tool call logged to audit trail (JSONL)
```

---

## Project Structure

```
aura_v1/
├── aura/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py                 # FastAPI app, lifespan, Container DI
│   │   │   ├── api/v1/                 # 40+ endpoint modules
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── health.py       # /healthz, /health, /status
│   │   │   │   │   ├── chat.py         # POST /chat (brain router + tools)
│   │   │   │   │   ├── chat_stream.py  # POST /chat/stream (SSE)
│   │   │   │   │   ├── agent_api.py    # /agent/chat, /agent/approvals
│   │   │   │   │   ├── engine_api.py   # /engine/status, start, stop
│   │   │   │   │   ├── voice_api.py    # /voice/tts, /voice/stt
│   │   │   │   │   └── ...
│   │   │   │   └── router.py           # Central API router
│   │   │   ├── services/
│   │   │   │   ├── brain_router.py     # LOCAL/CLOUD routing by complexity
│   │   │   │   ├── agent_service.py    # Tool calling orchestrator (max 10 loops)
│   │   │   │   ├── ollama_lifecycle.py # Auto start/stop with 10min idle timer
│   │   │   │   ├── claude_client.py    # Claude API via httpx
│   │   │   │   ├── safety_service.py   # L1/L2/L3 enforcement, audit, rollback
│   │   │   │   ├── mission_engine.py   # Multi-step task planner + executor
│   │   │   │   ├── sqlite_memory.py    # Preferences, projects, long-term memory
│   │   │   │   └── ...
│   │   │   └── tools/
│   │   │       ├── tool_registry.py    # BaseTool, ToolRegistry, AutonomyLevel
│   │   │       ├── shell_tool.py       # Shell with L3 command blocking
│   │   │       ├── browser_navigator.py# DOM extraction + AppleScript
│   │   │       ├── web_workflows.py    # GitHub/Vercel/Supabase templates
│   │   │       └── ...                 # 13 tools total
│   │   ├── tests/                      # 65 pytest tests
│   │   └── requirements.txt
│   └── frontend/
│       ├── app/                        # Next.js App Router
│       │   ├── chat/page.tsx           # Main workspace interface
│       │   ├── dashboard/page.tsx      # System metrics
│       │   ├── trust/page.tsx          # Safety dashboard
│       │   └── ...                     # 12 pages total
│       ├── components/
│       │   ├── chat/                   # WorkspaceChat, Composer, MessageList
│       │   ├── layout/                 # AppShell, Sidebar, TopBar
│       │   ├── mobile/                 # MobileLayout, tabs, quick-panel
│       │   └── ...
│       ├── lib/
│       │   ├── api.ts                  # Central API client (ngrok headers)
│       │   ├── chat-store.ts           # Zustand: messages, mode, provider
│       │   └── ...
│       └── middleware.ts               # Auth guard (cookie-based)
├── scripts/
│   ├── boot.sh                         # 5-phase boot: env → Ollama → model → ngrok → stack
│   ├── run-aura-stack                  # Supervisor: backend + frontend
│   ├── install-launch-agents           # macOS auto-start on login
│   ├── doctor                          # Health diagnostics
│   └── ...                             # 18 scripts total
├── packages/
│   ├── aura-core/                      # TypeScript: governance, memory, autonomy guard
│   └── aura-brain-claude/              # TypeScript: Claude integration layer
├── docs/                               # Architecture, security, product docs
├── config/models.yaml                  # Model routing config
└── CLAUDE.md                           # Project context for AI assistants
```

---

## Setup

### Prerequisites

- macOS (AppleScript tools are macOS-only)
- Python 3.11+
- Node.js 18+ and pnpm
- Ollama ([install](https://ollama.com))

### 1. Clone

```bash
git clone https://github.com/gregorydossantos/aura_v1.git
cd aura_v1
```

### 2. Backend

```bash
cd aura/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — at minimum set AURA_AUTH_TOKEN
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd aura/frontend
pnpm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm dev
```

### 4. Ollama + Model

```bash
ollama serve
ollama pull qwen3.5:9b
```

### 5. Boot (production)

```bash
# One-time: install macOS LaunchAgent for auto-start on login
./scripts/install-launch-agents

# Manual start (runs all 5 phases):
./scripts/boot.sh
```

The boot script is idempotent — it checks Ollama, pulls the model if missing, starts ngrok, and launches the full stack. Under LaunchAgent with `KeepAlive=true`, the entire stack restarts automatically if it crashes.

### 6. Remote access

The boot script starts an ngrok tunnel with a permanent domain. Access Aura from your phone at the configured URL. All requests require a bearer token.

---

## Design Decisions

- **Dual brain over single model** — Qwen handles ~80% of requests at zero cost; Claude handles the rest that need reasoning. Budget is configurable per day.
- **L3 is hardcoded** — Dangerous actions are blocked at the tool level with regex, not by prompt instructions. No configuration can promote an L3 action.
- **AppleScript over Playwright** — Zero dependencies, no browser binary to manage. DOM extraction via JS injection gives structured data without screenshots or vision models.
- **DOM extraction over screenshots** — Extracted DOM is ~2KB of structured text vs ~500KB image. Faster, cheaper, works with any text-based LLM.
- **Agent loop with cap** — The Agent Service runs up to 10 tool calls per message to prevent infinite loops while allowing multi-step tasks.
- **Ollama lifecycle management** — Auto-starts Ollama when a request arrives, auto-stops after 10 minutes idle. Keeps ~3GB RAM free when not in use.
- **SQLite over Postgres** — Single-user system, no need for connection pooling or network overhead. Memory, audit, and state all in local SQLite.

---

## Test Results

From the latest test run (2026-03-26):

**Backend (pytest):**
- 65 passed, 2 failed (pre-existing — require live Ollama in test env), 21 skipped

**E2E (22 tests across 8 groups):**

| Group | Tests | Result |
|-------|-------|--------|
| Infrastructure | 5 | All pass — backend, frontend, ngrok, Ollama |
| Ollama Lifecycle | 3 + 2 skip | Engine status, start, health all pass |
| Tool Layer | 5 | 13 tools registered, shell/git execute, L3 blocks `rm -rf` |
| Chat | 1 | Qwen responds correctly |
| Frontend Build | 2 | TypeScript clean, production build passes |
| Remote Access | 1 | Health endpoint reachable via ngrok |
| New Modules | 6 | DOM extractor, web workflow, attachment, lifecycle, app init |

**Security:** L3 blocking confirmed — `rm -rf /` returns `BLOQUEADO: Comando perigoso detectado`.

---

## Roadmap

### Done
- [x] FastAPI backend with 40+ endpoints
- [x] Next.js frontend with 12 pages (PWA, mobile-first)
- [x] Brain Router (local/cloud classification)
- [x] 13-tool Agent Service with autonomy enforcement
- [x] Ollama lifecycle (auto start/stop)
- [x] Missions engine (plan + execute + persist)
- [x] Safety layer (approval queue, audit, rollback)
- [x] Browser automation via DOM extraction
- [x] Voice pipeline (Web Speech API + edge-tts)
- [x] Boot automation (LaunchAgent, 5-phase script)
- [x] Remote access (ngrok permanent domain)
- [x] File upload and attachment processing

### Planned
- [ ] Persistent Claude API budget tracking (currently resets on restart)
- [ ] Proactive engine activation (implemented but not started in lifespan)
- [ ] Mission V2 integration (SmartRetry, Replanner exist but not wired)
- [ ] Calendar and Gmail integration (services exist, need API keys)
- [ ] Vector memory for semantic search
- [ ] Multi-device presence system

---

## Philosophy

> "Technology exists to return time to family — not to consume more of it."

> "Every sprint is evaluated against this metric: how many real hours does it return?"

Aura is built with one principle: automate the repetitive so the human can focus on what matters. Every feature is measured by whether it saves real time in a real workflow.

---

## Author

**Gregory** — Train operator (railway) and self-taught software engineer.
Built Aura as a personal AI ecosystem to automate daily workflows and reclaim time for family.

---

## License

Private — Personal use only.
