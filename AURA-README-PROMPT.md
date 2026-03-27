# PROMPT: README IMPECÁVEL PARA O GITHUB

Leia TODOS estes arquivos antes de escrever qualquer coisa:

```
~/Projetos/aura_v1/CLAUDE.md
~/Projetos/aura_v1/AUDIT.md
~/Projetos/aura_v1/TEST-RESULTS.md
~/Projetos/aura_v1/aura/backend/app/main.py
~/Projetos/aura_v1/aura/backend/app/tools/__init__.py
~/Projetos/aura_v1/aura/backend/app/api/v1/router.py
~/Projetos/aura_v1/aura/backend/app/services/agent_service.py
~/Projetos/aura_v1/aura/backend/app/services/ollama_lifecycle.py
~/Projetos/aura_v1/aura/backend/app/tools/tool_registry.py (ou equivalente)
~/Projetos/aura_v1/aura/frontend/package.json
~/Projetos/aura_v1/aura/backend/.env.example (se existir)
~/Projetos/aura_v1/scripts/ (todos os scripts)
```

Agora crie ~/Projetos/aura_v1/README.md — este é o README que aparece no GitHub.

## REGRAS DO README

1. TUDO que está no README deve ser REAL — baseado no código que você acabou de ler
2. NÃO invente features que não existem
3. NÃO use linguagem de marketing vazia — seja técnico e preciso
4. O tom é de um engenheiro sênior apresentando seu projeto, não de uma landing page
5. Use inglês (o repo é público e pode servir de portfólio)
6. O README deve impressionar um CTO em 30 segundos de scroll

## ESTRUTURA EXATA

```markdown
# ✦ Aura — Autonomous Personal AI Agent

> One-liner poderoso sobre o que a Aura faz (baseado no princípio fundador do Gregory)

Uma frase curta explicando: assistente pessoal AI que controla o Mac por voz,
com autonomia L1/L2/L3, dual-brain (local + cloud), e tool calling real.

---

## Demo

(seção curta dizendo que é projeto privado em uso pessoal ativo,
com screenshot placeholder se possível)

---

## Architecture

Diagrama ASCII art REAL da arquitetura atual:
- iPhone → ngrok → FastAPI Backend → Brain Router → Qwen local / Claude API
- Agent Service → Tool Registry → 13 tools
- Frontend Next.js → Vercel

Deve refletir o que REALMENTE existe no código, não o que é planejado.

---

## Features

Lista das features IMPLEMENTADAS E FUNCIONANDO (baseado no TEST-RESULTS.md):
- Voice commands (Web Speech API + edge-tts)
- 13 tools (listar todas com categoria)
- Dual brain (Qwen local free / Claude API paid)
- Ollama on-demand (auto-start, auto-stop 10min idle)
- Autonomy levels L1/L2/L3
- Browser automation via DOM extraction (AppleScript + JS injection)
- Web workflows (GitHub, Vercel, Supabase templates)
- File attachments (PDF, text, images, zip)
- Boot-on-login (LaunchAgent)
- Remote access (ngrok permanent domain)
- Audit trail (every tool call logged)
- 65 backend tests + 22 E2E tests

---

## Autonomy Levels

Tabela clara com L1, L2, L3 — exemplos reais de cada nível.
Destacar que L3 é HARDCODED — não pode ser promovido.

---

## Tool Layer

Tabela das 13 tools com: nome, descrição curta, nível de autonomia.
Baseado no output real do create_tool_registry().

---

## Tech Stack

Tabela organizada por camada:
- Backend: Python 3.11+, FastAPI, uvicorn, SQLite
- Frontend: Next.js 15, React 19, TypeScript, Tailwind, Vercel
- AI: Claude API (reasoning), Ollama + Qwen 3.5 (local/free)
- Infra: macOS, LaunchAgent, ngrok, GitHub Actions
- Voice: Web Speech API (STT), edge-tts (TTS)
- Browser: AppleScript + DOM extraction (zero Playwright)

---

## How It Works

Fluxo real em 6 passos:
1. Gregory sends voice command from iPhone
2. Web Speech API transcribes to text
3. Brain Router classifies complexity
4. Agent Service selects tools and executes
5. Autonomy Guard enforces L1/L2/L3
6. Response returned with TTS audio

---

## Project Structure

Árvore REAL do projeto (rode `find` e monte a árvore).
Mostre apenas os diretórios e arquivos principais, não tudo.

---

## Setup

Instruções REAIS para rodar o projeto:
1. Clone
2. Backend setup (venv, pip install, .env)
3. Frontend setup (pnpm install)
4. Ollama install + model pull
5. Boot script
6. Acesso local e remoto

Baseado nos scripts que existem (boot.sh, etc).

---

## Design Decisions

Lista dos ADRs se existirem, ou resumo das decisões arquiteturais:
- Memory lives in Core (LLM and executor are swappable)
- L3 is hardcoded (never promotable)
- Qwen for free/fast, Claude for complex/reliable
- AppleScript over Playwright (zero dependencies)
- DOM extraction over screenshots (no vision needed)

---

## Test Results

Resumo do TEST-RESULTS.md:
- Backend: X passed, Y failed, Z skipped
- E2E: X passed
- Security: L3 blocking confirmed

---

## Roadmap

O que está IMPLEMENTADO vs o que é PLANNED.
Ser honesto sobre o estado atual.
Marcar sprints completos vs pendentes.

---

## Philosophy

> Citação do princípio fundador:
> "Technology exists to return time to family — not to consume more of it."
> "Every sprint is evaluated against this metric: how many real hours does it return?"

---

## Author

Gregory — Railway operator and self-taught software engineer.
Built Aura as a personal AI ecosystem to automate daily workflows
and reclaim time for family.

---

## License

Private — Personal use only.
```

## DEPOIS DE ESCREVER O README

1. Verifique que TUDO mencionado é real (rode os comandos, confira os arquivos)
2. A árvore de diretórios deve refletir o projeto REAL
3. As 13 tools devem ser as que estão registradas no código
4. Os números de testes devem bater com o TEST-RESULTS.md
5. Commit e push:

```bash
cd ~/Projetos/aura_v1
git add README.md
git commit -m "docs: professional README — architecture, tools, setup, philosophy"
git push
```

## REGRAS FINAIS

- NÃO coloque badges genéricos (build passing, etc) — não tem CI configurado
- NÃO coloque screenshots se não existem — coloque placeholder honesto
- NÃO mencione features que são "planned" como se fossem "done"
- NÃO use emojis excessivos — máximo nos headers principais
- O README deve ter entre 200-400 linhas — longo o suficiente pra impressionar, curto o suficiente pra ler
- Priorize clareza sobre estética
