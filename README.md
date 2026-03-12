# Aura

**AI Companion Operacional Pessoal**

Aura é um companion operacional local-first, multimodal e acionável, criado para atuar como extensão digital confiável do usuário. O produto combina conversa natural, memória contextual, apoio à decisão e execução segura de operações reais em uma arquitetura preparada para evolução enterprise.

## Product Vision

Aura existe para profissionais que querem reduzir fricção entre diálogo, organização, execução e contexto digital. Em vez de funcionar como mais um chatbot reativo, Aura foi desenhada para operar como uma presença de software contínua: conversa, lembra, estrutura metas, aciona ferramentas e mantém rastreabilidade das ações.

Aura não é apenas uma interface conversacional. Ela foi projetada para organizar contexto, apoiar decisões e operar sobre o ambiente digital do usuário com segurança e clareza.

## Core Capabilities

- `conversational intelligence`: interação natural em português com suporte a fluxos operacionais
- `contextual memory`: memória de curto e longo prazo para sessões, jobs e contexto persistido
- `project and operations support`: suporte a projetos, navegação, status e tarefas recorrentes
- `tools and actions`: execução segura por allowlist para terminal, sistema, arquivos e VS Code
- `local-first runtime`: operação completa em máquina local com JSON e Ollama
- `multi-model orchestration`: roteamento entre Ollama, OpenAI e Anthropic por perfil de tarefa
- `voice runtime`: pipeline modular para wake word, STT, agent loop e TTS
- `research runtime`: fluxo de busca, coleta, sumarização e resposta estruturada

## System Architecture

Aura está organizada em camadas para separar interface, orquestração, execução e persistência:

- `frontend`: Next.js 15 para chat, visão operacional e experiência de uso
- `backend/api`: FastAPI com endpoints versionados e contratos estáveis
- `core services`: autenticação, projetos, persistência, memória, comandos e integrações base
- `Aura OS layer`: loop cognitivo `perceive -> reason -> plan -> act -> learn`, agentes, memória, tools, voice e model routing
- `infra/deploy`: Vercel, Supabase, macOS runtime e scripts operacionais
- `integrations`: Ollama local e provedores cloud preparados para ativação controlada

## Repository Structure

```text
/
├── .github/           # CI e automações do repositório
├── aura/
│   ├── backend/       # API FastAPI, serviços, Aura OS e testes
│   └── frontend/      # Aplicação Next.js e assets web
├── config/            # Configuração de modelos e runtime
├── docs/
│   ├── architecture/  # Visão técnica canônica do sistema
│   ├── engineering/   # Standards e governança de implementação
│   ├── operations/    # Deploy, runbooks e operação
│   ├── product/       # Visão, posicionamento e roadmap
│   ├── prompts/       # Materiais internos de prompting e design guidance
│   └── archive/       # Legado consolidado e histórico documental
├── infra/             # Artefatos de deploy e infraestrutura
├── scripts/           # Scripts locais de execução e suporte
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
└── ROADMAP.md
```

## Quick Start

### Pré-requisitos

- Python 3.11 recomendado
- Node.js 20+
- `pnpm` 10+
- Ollama ativo em `http://localhost:11434`
- modelo local `qwen3.5:9b`

### Instalação

```bash
cd aura/backend
python3 -m pip install -r requirements.txt
```

```bash
cd aura/frontend
pnpm install
```

### Execução do backend

```bash
./scripts/run-backend
```

### Execução do frontend

```bash
./scripts/run-frontend
```

### Variáveis de ambiente essenciais

Backend:

```env
AURA_ENV=development
AURA_MODEL=qwen3.5:9b
OLLAMA_URL=http://localhost:11434
AURA_AUTH_TOKEN=change-me
AURA_REQUIRE_AUTH=true
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_AURA_ENV=local
NEXT_PUBLIC_AURA_TOKEN=change-me
```

### Comandos essenciais

```bash
cd aura/backend && python3 -m pytest
cd aura/frontend && pnpm lint && pnpm typecheck && pnpm build
```

## Operation Modes

- `local-first`: backend, memória e execução local com JSON, token simples e Ollama
- `cloud-ready`: Supabase pode assumir dados e autenticação sem remover a lógica operacional local
- `hybrid / dual auth`: backend aceita token local e credenciais Supabase quando `AURA_AUTH_MODE=dual`

## Engineering Standards

Aura segue um padrão de evolução orientado a produto operacional:

- segurança de execução acima de conveniência
- modularidade com responsabilidade explícita por camada
- observabilidade por logs e trilha de auditoria
- configuração por ambiente, sem acoplamento a máquina pessoal
- crescimento incremental sem quebrar o runtime atual

Os padrões completos estão em [docs/engineering/standards.md](docs/engineering/standards.md).

## Roadmap Summary

- curto prazo: consolidar runtime local, observabilidade, governança documental e fluxo seguro de jobs
- médio prazo: memória persistente mais robusta, pesquisa enriquecida, voz local madura e integrações operacionais
- longo prazo: runtime multimodal completo, cloud híbrida, automações confiáveis e roteamento avançado por contexto

O roadmap executivo está em [ROADMAP.md](ROADMAP.md) e o detalhado em [docs/product/roadmap.md](docs/product/roadmap.md).

## Documentation Map

- visão do produto: [docs/product/vision.md](docs/product/vision.md)
- posicionamento: [docs/product/positioning.md](docs/product/positioning.md)
- arquitetura geral: [docs/architecture/overview.md](docs/architecture/overview.md)
- runtime Aura OS: [docs/architecture/runtime.md](docs/architecture/runtime.md)
- memória: [docs/architecture/memory.md](docs/architecture/memory.md)
- voz: [docs/architecture/voice.md](docs/architecture/voice.md)
- tools: [docs/architecture/tools.md](docs/architecture/tools.md)
- model router: [docs/architecture/model-router.md](docs/architecture/model-router.md)
- deploy: [docs/operations/deploy.md](docs/operations/deploy.md)
- runbooks: [docs/operations/runbooks.md](docs/operations/runbooks.md)

## Positioning Statement

Aura é um produto de IA operacional construído para centralizar diálogo, organização, inteligência e ação em uma presença única, confiável e evolutiva. A inspiração em JARVIS e Friday aparece na experiência desejada de precisão, contexto e prontidão, sem sacrificar maturidade técnica, governança e segurança de execução.
