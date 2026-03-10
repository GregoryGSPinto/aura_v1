# Aura v1

Aura evoluiu de uma assistente operacional local-first para a base de um **Personal AI Operating System**. O projeto preserva o runtime atual em FastAPI + Next.js + Ollama, mas agora possui uma nova espinha dorsal modular para agent loop, memória, tools registry, integrações multi-modelo e pipeline de voz.

## Arquitetura

```text
Client Layer
  └─ aura/frontend (Next.js, TypeScript, Tailwind, Vercel-ready)
API Layer
  └─ aura/backend/app/api (FastAPI)
Core Layer
  ├─ OllamaService
  ├─ CommandService
  ├─ ProjectService
  ├─ AuthService
  ├─ PersistenceService
  └─ SupabaseService
System Layer
  └─ macOS, VS Code, terminal, Ollama
AI OS Layer
  └─ aura/backend/app/aura_os
     ├─ core
     ├─ memory
     ├─ voice
     ├─ tools
     ├─ integrations
     └─ config
```

## Modos de operação

- `local-first`: JSON local + token simples
- `cloud-ready`: FastAPI + Supabase para projetos, settings, auditoria e sessões
- `dual auth`: token local e Supabase Auth convivendo no backend

## Estrutura

```text
aura/
  backend/
  frontend/
  docs/
  backend/app/aura_os/
docs/
infra/
  supabase/
  vercel/
scripts/
README.md
```

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS
- Backend: FastAPI, Pydantic, httpx
- LLM local: Ollama em `http://localhost:11434`
- Modelo padrão: `qwen3.5:9b`
- Dados: JSON local com fallback e sincronização opcional com Supabase
- Publicação: GitHub + Vercel

## Requisitos

- Python 3.9+
- Node.js 20+
- pnpm 10+
- Ollama ativo
- Modelo `qwen3.5:9b` disponível
- VS Code com `code` habilitado

## Setup local

### Backend

```bash
cd aura/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd aura/frontend
cp .env.example .env.local
pnpm install
pnpm dev --host 0.0.0.0 --port 3000
```

## Variáveis de ambiente

### Backend

- `AURA_APP_NAME`
- `AURA_ENV`
- `AURA_API_PREFIX`
- `AURA_AUTH_MODE`
- `AURA_MODEL`
- `OLLAMA_URL`
- `AURA_ALLOWED_ORIGINS`
- `AURA_AUTH_TOKEN`
- `AURA_REQUIRE_AUTH`
- `AURA_PROJECTS_FILE`
- `AURA_SETTINGS_FILE`
- `AURA_AUDIT_LOG_FILE`
- `AURA_AUDIT_JSON_FILE`
- `AURA_CHAT_SESSIONS_FILE`
- `AURA_CHAT_MESSAGES_FILE`
- `AURA_COMMAND_TIMEOUT`
- `AURA_LLM_TIMEOUT`
- `AURA_HTTP_TIMEOUT`
- `AURA_SUPABASE_ENABLED`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`

### Frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AURA_ENV`
- `NEXT_PUBLIC_AURA_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## URLs locais

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

## Endpoints principais

- `GET /api/v1/status`
- `GET /api/v1/auth/status`
- `POST /api/v1/chat`
- `POST /api/v1/command`
- `GET /api/v1/projects`
- `POST /api/v1/projects/open`
- `GET /api/v1/os/overview`
- `POST /api/v1/os/agent/execute`

## Scripts úteis

- `scripts/run-backend`
- `scripts/run-frontend`
- `scripts/dev-all`

## GitHub

```bash
git init
git add .
git commit -m "feat: professionalize aura v1"
git branch -M main
git remote add origin <repo>
git push -u origin main
```

## Supabase

1. Crie o projeto no Supabase.
2. Execute `infra/supabase/schema.sql`.
3. Execute `infra/supabase/seed.sql`.
4. Configure as envs do backend.
5. Ative `AURA_SUPABASE_ENABLED=true`.

Guias detalhados:

- `docs/supabase.md`
- `docs/deployment.md`

## Vercel

```bash
cd aura/frontend
pnpm install
pnpm lint
pnpm typecheck
pnpm build
vercel
```

Configure no painel:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AURA_ENV`
- `NEXT_PUBLIC_AURA_TOKEN` se ainda usar token local
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Guia detalhado: `docs/vercel.md`

## O que fica pronto agora

- Backend pronto para local e cloud
- Persistência dual local/Supabase
- Auth local, Supabase ou dual
- Frontend Vercel-ready com checagem de env
- Infra SQL inicial para Supabase
- Documentação para publicação e operação
- Estratégia de teste operacional no Mac em `docs/usability-testing.md`
- Jobs autônomos com fila local, retomada após reinício e logs persistidos
- Nova camada `aura_os` com architecture-ready modules:
  - agent loop
  - memory manager
  - tools registry
  - voice pipeline preparada
  - providers para Ollama/OpenAI/Anthropic

## Documentos de arquitetura

- `ARCHITECTURE.md`
- `AGENTS.md`
- `TOOLS.md`
- `CHANGELOG.md`
- `MEMORY.md`
