# AURA — Contexto para Claude Code

## O que é
Aura é uma assistente pessoal AI autônoma criada por Gregory (maquinista ferroviário e engenheiro de software autodidata). A visão: mandar áudio do iPhone → Aura entende, executa, entrega pronto.

---

## Arquitetura
- **Backend:** Python/FastAPI (porta 8000) em `~/Projetos/aura_v1/aura/backend/`
- **Frontend:** Next.js 15 + React 19 em `~/Projetos/aura_v1/aura/frontend/`
- **LLM local:** Ollama + Qwen3.5:9b (conversa simples, zero custo)
- **LLM remoto:** Claude API via `claude-sonnet-4-20250514` (raciocínio complexo, tool calling)
- **Tunnel:** ngrok / Cloudflare permanent domain (var `NEXT_PUBLIC_API_URL`)
- **Deploy frontend:** Vercel
- **DB:** SQLite (memória e estado) via `SQLiteMemoryService`
- **State frontend:** Zustand 5 com SSR safety (`typeof window !== 'undefined'`)

---

## Estrutura de diretórios

```
aura_v1/
├── aura/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py                    # FastAPI app, lifespan, routers, CORS
│   │   │   ├── api/                       # Endpoints por domínio
│   │   │   │   ├── chat_api.py            # POST /chat, POST /chat/stream
│   │   │   │   ├── mission_api.py         # CRUD + execute /missions/*
│   │   │   │   ├── claude_bridge_api.py   # /claude/mission/* (ClaudeBridge)
│   │   │   │   ├── deploy_api.py          # GitHub + Vercel + /deploy/*
│   │   │   │   ├── memory_api.py          # SQLite preferences, projects, long memory
│   │   │   │   ├── routine_api.py         # CRUD + trigger /routines/*
│   │   │   │   ├── workflow_api.py        # CRUD + execute /workflows/*
│   │   │   │   ├── safety_api.py          # Approval queue, rollback, audit
│   │   │   │   ├── proactive_api.py       # Alerts, insights, opinions
│   │   │   │   ├── voice_api.py           # STT (whisper), TTS (say), /voice/*
│   │   │   │   ├── briefing_api.py        # Daily briefing aggregado
│   │   │   │   ├── system_api.py          # CPU/RAM/disk/Ollama engine
│   │   │   │   ├── terminal_api.py        # WS /terminal/ws (interactive)
│   │   │   │   ├── health_api.py          # /healthz, /health, /status
│   │   │   │   ├── auth_api.py            # /auth/login, /auth/status
│   │   │   │   ├── projects_api.py        # /projects, /projects/discover
│   │   │   │   ├── jobs_api.py            # Job queue CRUD
│   │   │   │   ├── files_api.py           # Filesystem read/write/find
│   │   │   │   ├── git_api.py             # Git ops via API
│   │   │   │   ├── integrations_api.py    # Calendar, Gmail, Docs
│   │   │   │   ├── brain_api.py           # GET /brain/status
│   │   │   │   ├── tools_api.py           # Tool registry
│   │   │   │   ├── workspace_api.py       # Workspace views
│   │   │   │   ├── push_api.py            # Web Push / VAPID
│   │   │   │   └── ...
│   │   │   ├── services/                  # Lógica de negócio
│   │   │   │   ├── ollama_service.py      # LLM local (geração + streaming)
│   │   │   │   ├── claude_client.py       # Claude API via httpx
│   │   │   │   ├── brain_router.py        # Roteamento LOCAL/CLOUD por complexidade
│   │   │   │   ├── chat_router_service.py # Orquestrador de tool calling no chat
│   │   │   │   ├── claude_bridge.py       # Executa `claude` CLI como subprocess
│   │   │   │   ├── mission_engine.py      # MissionPlanner + MissionExecutor V1
│   │   │   │   ├── mission_v2/            # SmartRetry, Replanner, Evaluator (não wired)
│   │   │   │   ├── sqlite_memory.py       # SQLiteMemoryService (preferences, long_memory)
│   │   │   │   ├── safety_service.py      # PERMISSION_MAP L1/L2/L3, audit SQLite
│   │   │   │   ├── proactive_engine.py    # Alerts, insights, personality traits
│   │   │   │   ├── proactive_service.py   # ⚠️ Loop BG implementado mas nunca iniciado
│   │   │   │   ├── routine_service.py     # Scheduler croniter (⚠️ shadow bug)
│   │   │   │   ├── workflow_engine.py     # Workflow CRUD + execução
│   │   │   │   ├── job_service.py         # Worker thread com poll interval
│   │   │   │   ├── github_service.py      # GitHub API (repos, branches, PRs)
│   │   │   │   ├── vercel_service.py      # Vercel API (projects, deploy)
│   │   │   │   ├── deploy_orchestrator.py # git → GitHub → Vercel fluxo completo
│   │   │   │   ├── knowledge_extractor.py # Extrai preferências de mensagens via LLM
│   │   │   │   ├── daily_briefing.py      # Agrega cal+email+missions+deploy
│   │   │   │   ├── calendar_service.py    # Google Calendar (requer API key)
│   │   │   │   ├── email_service.py       # Gmail IMAP (requer credenciais)
│   │   │   │   ├── auth_service.py        # Token único com hmac.compare_digest
│   │   │   │   ├── context_service.py     # Runtime context builder
│   │   │   │   ├── behavior_service.py    # System prompt por modo
│   │   │   │   └── ...
│   │   │   ├── aura_os/                   # AI Operating System (desativado por feature flag)
│   │   │   │   ├── core/                  # agent.py, agent_loop.py, planner, reasoner
│   │   │   │   ├── integrations/          # anthropic.py, openai.py, ollama.py, model_router.py
│   │   │   │   ├── memory/                # manager.py, short_term, long_term, vector_store (stub)
│   │   │   │   ├── tools/                 # registry.py, permissions.py, research/
│   │   │   │   ├── agents/                # router, automation, developer, research, system agents
│   │   │   │   ├── automation/            # scheduler, actions, workflows
│   │   │   │   ├── connectors/            # base, registry, implementations/
│   │   │   │   ├── voice/                 # pipeline, STT/whisper, TTS/say, wakeword
│   │   │   │   └── config/settings.py     # AuraOSSettings (PyYAML)
│   │   │   ├── core/
│   │   │   │   ├── config.py              # Settings com todas as env vars
│   │   │   │   ├── container.py           # Dependency injection (instancia todos services)
│   │   │   │   └── security_policies.py   # Rate limiting in-memory
│   │   │   ├── models/                    # Pydantic models
│   │   │   └── tools/                     # ToolRegistry, ToolExecutor, aura_dev.py
│   │   ├── data/                          # JSONs de persistência (projects, jobs, etc.)
│   │   ├── tests/                         # 16 arquivos pytest (unitários)
│   │   ├── .env                           # ⚠️ CONTÉM CREDENCIAIS REAIS — não commitar
│   │   ├── .env.example                   # Template (incompleto — faltam 11 vars)
│   │   ├── requirements.txt               # Dependências Python
│   │   └── croniter.py                    # ⚠️ BUG: shadowing o pacote croniter instalado
│   └── frontend/
│       ├── app/                           # Next.js App Router
│       │   ├── page.tsx                   # Landing → /chat
│       │   ├── chat/page.tsx              # Interface principal (WorkspaceLayout)
│       │   ├── dashboard/page.tsx         # Métricas de sistema
│       │   ├── memory/page.tsx            # Memória SQLite
│       │   ├── projects/page.tsx          # Projetos
│       │   ├── routines/page.tsx          # Rotinas
│       │   ├── workflows/page.tsx         # Workflows
│       │   ├── settings/page.tsx          # Configurações
│       │   ├── system/page.tsx            # Métricas do sistema
│       │   ├── remote/page.tsx            # Controle remoto
│       │   ├── swarm/page.tsx             # Agent jobs
│       │   ├── trust/page.tsx             # Safety dashboard
│       │   └── login/page.tsx             # Auth
│       ├── components/
│       │   ├── chat/                      # WorkspaceChat, MessageList, Composer, etc.
│       │   ├── layout/                    # WorkspaceLayout, AppShell, Sidebar, TopBar
│       │   ├── mobile/                    # MobileLayout + tabs + quick-panel
│       │   ├── editor/                    # CodeEditor, FileExplorer, DiffViewer
│       │   ├── terminal/                  # TerminalPanel (WS), AnsiParser
│       │   ├── missions/                  # MissionPanel, MissionDetailCard
│       │   ├── safety/                    # ApprovalDialog, AuditPanel
│       │   ├── deploy/                    # DeployStatusCard
│       │   ├── proactive/                 # ProactiveAlertBar
│       │   ├── briefing/                  # DailyBriefing
│       │   ├── integrations/              # CalendarWidget, EmailWidget
│       │   ├── panels/                    # MemoryPanel, ContextPanel, TrustPanel
│       │   └── ui/                        # Badge, Button, Card, LoadingSpinner
│       ├── lib/
│       │   ├── api.ts                     # API client central (fetchApi + ngrok header)
│       │   ├── auth-store.ts              # Zustand: token, isAuthenticated
│       │   ├── chat-store.ts              # Zustand: messages, mode, provider, wsState
│       │   ├── editor-store.ts            # Zustand: arquivos abertos, conteúdo
│       │   ├── terminal-store.ts          # Zustand: linhas, histórico, cwd
│       │   ├── workspace-store.ts         # Zustand: layout preset, painéis
│       │   └── preview-store.ts           # Zustand: preview URL
│       ├── middleware.ts                  # Auth guard por cookie aura_token
│       ├── .env.local                     # ⚠️ NEXT_PUBLIC_AURA_TOKEN exposto
│       └── package.json                   # Next.js 15, React 19, Zustand 5, Tailwind 3
├── docs/                                  # Documentação arquitetural (architecture/, product/, security/)
├── packages/
│   ├── aura-brain-claude/                 # TypeScript: Claude integration layer
│   └── aura-core/                         # TypeScript: Governance, Memory, Autonomy
├── config/
│   └── models.yaml                        # default: openai, coding: anthropic, local: ollama
├── scripts/                               # Scripts de deploy/dev
├── ROADMAP.md                             # Roadmap em Fases 1-4
├── AUDIT.md                               # Code review completo (gerado em 2026-03-26)
└── CLAUDE.md                              # Este arquivo
```

---

## Convenções
- **Backend:** Python 3.11+, FastAPI, async everywhere, type hints obrigatórios
- **Frontend:** TypeScript strict, pnpm, Tailwind, componentes em PascalCase
- **API:** prefixo `/api/v1/`, auth via `Authorization: Bearer <token>`
- **Commits:** emoji + descrição curta em português
- **Testes:** pytest no backend (`/aura/backend/tests/`), vitest no frontend (quando implementados)
- **SSR safety:** todos os Zustand stores usam `typeof window !== 'undefined'` antes de acessar localStorage

---

## Autonomia L1/L2/L3
- **L1 (autônomo):** pesquisa, organização, leitura de código, análise
- **L2 (precisa aprovação):** comunicação externa, deploy, commits, escrita em arquivos do projeto
- **L3 (bloqueado):** financeiro, legal, ações irreversíveis, rotação de credenciais de produção

O `SafetyService` no backend implementa esse mapa em `PERMISSION_MAP` com três níveis: `free`, `confirm`, `critical`.

---

## Brain Router
O `BrainRouter` em `services/brain_router.py` classifica cada mensagem por regex e roteia:

- **LOCAL (Ollama/Qwen3.5:9b):** saudações, conversas, explicações simples, tarefas triviais
- **CLOUD (Claude API):** análise complexa, tool calling, missões, código, debugging

Budget diário de chamadas Claude configurável via `AURA_CLAUDE_DAILY_BUDGET_CENTS`.
**Atenção:** budget reseta a cada restart do servidor (sem persistência em SQLite ainda).

---

## Comandos úteis
```bash
# Backend
cd ~/Projetos/aura_v1/aura/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend
cd ~/Projetos/aura_v1/aura/frontend
pnpm dev

# Ollama (LLM local)
ollama serve           # auto-start via LaunchAgent no macOS
ollama run qwen2.5:7b  # modelo padrão de conversa

# Health check
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/healthz

# Testes backend
cd ~/Projetos/aura_v1/aura/backend
pytest tests/ -v
```

---

## Estado atual (auditado em 2026-03-26)

### O que funciona
- **Chat completo:** BrainRouter (local/cloud), tool calling, streaming SSE, persistência de sessão
- **Missões V1:** planner LLM + executor passo a passo + SQLite (`/missions/*`)
- **Deploy pipeline:** GitHub API + Vercel API + fluxo completo (`/deploy/full`)
- **Memory SQLite:** preferências, projetos, sessão, long memory (`/memory/*`)
- **Safety layer:** approval queue, rollback registry, audit log
- **Routines + Workflows + Jobs:** CRUD completo com execução
- **Terminal WebSocket:** `/terminal/ws` interativo com BLOCKED_PATTERNS
- **Voice básico:** STT via whisper-cpp, TTS via macOS `say` (se binários disponíveis)
- **Frontend completo:** PWA, mobile layout, workspace IDE, todas as páginas

### Issues conhecidos (ver AUDIT.md para detalhe)
1. **⚠️ CRÍTICO:** `.env` com credenciais reais commitado — rotacionar `AURA_AUTH_TOKEN` e `AURA_ADMIN_PASSWORD`
2. **⚠️ BUG:** `/aura/backend/croniter.py` shadowing o pacote `croniter==6.2.2` — renomear o arquivo
3. **⚠️ DESLIGADO:** `ProactiveService.start()` nunca chamado no lifespan da app
4. **⚠️ NÃO WIRED:** Mission V2 (`SmartRetry`, `MissionReplanner`) existe mas não é chamado pelo executor
5. **⚠️ BUG:** `BrainRouter.track_usage()` usa `=` em vez de `+=` — stats nunca acumulam
6. **⚠️ BYPASSA:** `/chat/stream` não passa pelo BrainRouter — sempre usa Ollama local
7. **⚠️ RESÍDUO:** `pages/_app.tsx` e `pages/_document.tsx` coexistem com App Router

### Próximos passos recomendados (em ordem)
1. Rotacionar credenciais + corrigir `.gitignore`
2. Renomear `backend/croniter.py` para `croniter_compat.py` ou remover
3. Chamar `proactive_service.start()` no lifespan
4. Corrigir `track_usage` no BrainRouter (`+= 1`)
5. Completar `.env.example` com as 11 variáveis ausentes
6. Integrar `SmartRetry.should_retry()` no `MissionExecutor._execute_step()`

---

## Regras
- **NUNCA** hardcode API keys — sempre `.env`
- **NUNCA** quebre o que já funciona ao implementar algo novo
- **SEMPRE** rode o backend e teste o endpoint antes de considerar pronto
- **Headers ngrok:** sempre incluir `ngrok-skip-browser-warning: true` nos requests do frontend
- **Mobile first:** touch targets mínimo 44px, funcionar em 4G com conexão instável
- **Qwen local:** sempre usar `"think": false` e sem `num_predict` limit
- **Imports Python:** não criar arquivos com nomes que colidam com pacotes do `requirements.txt`
- **SSR:** qualquer novo Zustand store precisa do guard `typeof window !== 'undefined'` para não crashar no servidor Next.js
- **Auth:** todos os endpoints novos devem passar pelo `AuthMiddleware` — verificar `Depends(verify_token)` no router
