# macOS Autostart da Aura

## Objetivo

Esta operação instala um `LaunchAgent` de usuário para iniciar a stack local da Aura no login do macOS sem abrir Terminal, iTerm ou aliases manuais.

O supervisor sobe nesta ordem:

1. `Ollama`
2. backend FastAPI
3. frontend Next.js

Se algum processo cair, o supervisor tenta restaurar a stack automaticamente.

## Pré-requisitos únicos

- macOS com login gráfico do usuário
- `python3`
- `node`
- `pnpm`
- `ollama`
- dependências do backend já instaladas em `aura/backend/.venv` ou no Python do sistema
- dependências do frontend já instaladas em `aura/frontend/node_modules`

Setup inicial recomendado:

```bash
cd aura/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

```bash
cd aura/frontend
pnpm install
```

## Scripts operacionais

- `./scripts/run-ollama`: inicia `ollama serve`
- `./scripts/run-backend`: inicia o FastAPI; usa reload apenas em shell interativo
- `./scripts/run-frontend`: inicia o Next.js em modo `dev` por padrão
- `./scripts/run-aura-stack`: supervisor da stack local
- `./scripts/stop-aura-stack`: para supervisor e subprocessos da Aura
- `./scripts/healthcheck-aura`: valida Ollama, backend e frontend
- `./scripts/install-launch-agents`: instala e ativa o `LaunchAgent`
- `./scripts/uninstall-launch-agents`: remove o `LaunchAgent`

## Instalação

```bash
./scripts/install-launch-agents
```

O instalador:

- cria `~/Library/Logs/Aura`
- materializa `~/Library/LaunchAgents/com.gregory.aura.stack.plist`
- substitui o caminho absoluto do repositório no `.plist`
- faz `bootout` do agente anterior se existir
- faz `bootstrap` e `kickstart` do agente novo

## Teste local

Verificar saúde:

```bash
./scripts/healthcheck-aura
```

Reiniciar logicamente a stack:

```bash
./scripts/stop-aura-stack
./scripts/run-aura-stack
```

## Logs

Todos os logs ficam em:

```text
~/Library/Logs/Aura/
```

Arquivos principais:

- `launchd.stack.stdout.log`
- `launchd.stack.stderr.log`
- `ollama.log`
- `backend.log`
- `frontend.log`

## Comandos úteis

Listar o agente:

```bash
launchctl list | grep com.gregory.aura.stack
```

Recarregar o agente:

```bash
./scripts/install-launch-agents
```

Parar a stack:

```bash
./scripts/stop-aura-stack
```

Desinstalar:

```bash
./scripts/uninstall-launch-agents
```

## Diagnóstico

- porta `11434` ocupada por outro processo: revisar conflito com outro runtime LLM
- porta `8000` ocupada por outro processo: revisar backend antigo manual
- porta `3000` ocupada por outro processo: revisar outro app Next.js
- `ollama` não encontrado: instalar Ollama e confirmar `which ollama`
- `pnpm` não encontrado fora do terminal: validar instalação em `/opt/homebrew/bin` ou `/usr/local/bin`
- backend sem responder: revisar `aura/backend/.env` e dependências Python
- frontend sem responder: revisar `aura/frontend/.env.local` e `node_modules`

## Variáveis suportadas

- `AURA_BACKEND_HOST`
- `AURA_BACKEND_PORT`
- `AURA_FRONTEND_HOST`
- `AURA_FRONTEND_PORT`
- `AURA_FRONTEND_MODE`
- `AURA_OPEN_BROWSER_AT_LOGIN=1`
- `AURA_STACK_HEALTH_INTERVAL`
- `AURA_OLLAMA_HEALTH_TIMEOUT`
- `AURA_BACKEND_HEALTH_TIMEOUT`
- `AURA_FRONTEND_HEALTH_TIMEOUT`

As variáveis do backend continuam sendo lidas de `aura/backend/.env`. As do frontend continuam sendo lidas de `aura/frontend/.env.local`.
