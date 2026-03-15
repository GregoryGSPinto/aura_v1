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

## MVP Local-First

O runtime padrão agora prioriza o fluxo local de ponta a ponta:

- frontend Next.js em `http://127.0.0.1:3000`
- backend FastAPI em `http://127.0.0.1:8000`
- autenticação por bearer token local
- chat real com Ollama local
- persistência mínima em JSON dentro de `aura/backend/data/json`
- partes avançadas do Aura OS atrás de feature flags, desativadas por padrão no MVP

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

### Bootstrap único

```bash
./scripts/dev-up
```

O script:

- garante `.env` e `.env.local` a partir dos exemplos
- valida Python, Node, `pnpm`, backend, frontend e Ollama
- tenta apontar falta de modelo ou desalinhamento de token
- sobe backend e frontend em background
- mostra URLs e logs finais

### Diagnóstico

```bash
./scripts/doctor
```

O `doctor` verifica:

- envs obrigatórias
- token local alinhado entre backend e frontend
- backend no ar
- frontend no ar
- Ollama acessível
- modelo `AURA_MODEL` disponível
- CORS básico
- portas locais em conflito

### Execução isolada do backend

```bash
./scripts/run-backend
```

### Execução isolada do frontend

```bash
./scripts/run-frontend
```

### Autostart no macOS

Para iniciar Ollama, backend e frontend automaticamente no login do usuário via `launchd`:

```bash
./scripts/install-launch-agents
./scripts/healthcheck-aura
```

A operação completa está em [docs/operations/macos-autostart.md](docs/operations/macos-autostart.md).

### Variáveis de ambiente essenciais

Backend:

```env
AURA_ENV=development
AURA_LOCAL_MODE=true
AURA_MODEL=qwen3.5:9b
OLLAMA_URL=http://localhost:11434
AURA_AUTH_TOKEN=change-me
AURA_REQUIRE_AUTH=true
AURA_ENABLE_OS_RUNTIME=false
AURA_ENABLE_RESEARCH=false
AURA_ENABLE_CLOUD_PROVIDERS=false
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_AURA_ENV=local
NEXT_PUBLIC_AURA_TOKEN=change-me
```

### Comandos essenciais

```bash
cd aura/backend && python3 -m pytest
cd aura/frontend && pnpm lint && pnpm typecheck && pnpm build
```

### Teste manual do chat

1. Rode `./scripts/dev-up`
2. Abra `http://127.0.0.1:3000/chat`
3. Envie uma mensagem simples
4. Valide resposta do Ollama
5. Rode `./scripts/doctor` se algo falhar

### Erros comuns

- `Backend offline`
  Correção: rode `./scripts/run-backend` ou `./scripts/dev-up`
- `Falha de autenticação`
  Correção: alinhe `AURA_AUTH_TOKEN` com `NEXT_PUBLIC_AURA_TOKEN`
- `Ollama indisponível`
  Correção: inicie o serviço local do Ollama em `http://localhost:11434`
- `Modelo indisponível`
  Correção: rode `ollama pull qwen3.5:9b`
- `Porta em uso`
  Correção: encerre o processo ocupando `3000` ou `8000`, ou ajuste as envs de porta

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
- autostart macOS: [docs/operations/macos-autostart.md](docs/operations/macos-autostart.md)

## Positioning Statement

Aura é um produto de IA operacional construído para centralizar diálogo, organização, inteligência e ação em uma presença única, confiável e evolutiva. A inspiração em JARVIS e Friday aparece na experiência desejada de precisão, contexto e prontidão, sem sacrificar maturidade técnica, governança e segurança de execução.
