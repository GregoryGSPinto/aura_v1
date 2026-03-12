# Visão Geral da Arquitetura

Aura combina aplicação web, API, serviços operacionais e uma camada de runtime cognitivo chamada Aura OS.

## Arquitetura em camadas

```text
Experience Layer
  aura/frontend

API Layer
  aura/backend/app/api

Application Services
  auth, projects, persistence, memory, commands, jobs

Aura OS Layer
  core, agents, memory, tools, voice, integrations, automation, config

Infrastructure Layer
  local JSON, Ollama, Supabase, Vercel, macOS services
```

## Frontend

O frontend em `aura/frontend` entrega a experiência de chat e operação com Next.js, TypeScript e Tailwind. Ele consome a API versionada e está preparado para execução local e publicação em Vercel.

## Backend e API

O backend em `aura/backend` usa FastAPI como camada de entrada para autenticação, chat, projetos, jobs, status, ferramentas e Aura OS. Os serviços existentes continuam sendo a fonte operacional de verdade.

## Aura OS

Aura OS é a camada que organiza raciocínio, planejamento, memória, roteamento e execução controlada. Ela não substitui os serviços legados do backend; compõe esses serviços para viabilizar novos runtimes sem quebrar a base atual.

## Persistência

O modo padrão é local-first com arquivos JSON. Opcionalmente, Supabase pode assumir partes da persistência e autenticação em cenários cloud-ready ou híbridos.

## Integrações principais

- Ollama para inferência local
- OpenAI e Anthropic preparados como provedores opcionais
- VS Code, terminal, filesystem e browser como superfícies operacionais
- Supabase para dados e autenticação quando habilitado

## Documentos relacionados

- [runtime.md](runtime.md)
- [memory.md](memory.md)
- [voice.md](voice.md)
- [tools.md](tools.md)
- [model-router.md](model-router.md)
