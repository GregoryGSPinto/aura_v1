# Runbooks Operacionais

## Desenvolvimento local

Backend:

```bash
./scripts/run-backend
```

Frontend:

```bash
./scripts/run-frontend
```

## Validação de qualidade

Backend:

```bash
cd aura/backend
pytest
```

Frontend:

```bash
cd aura/frontend
pnpm lint
pnpm typecheck
pnpm build
```

## Verificação de saúde

- `GET /`
- `GET /api/v1/status`
- `GET /api/v1/system/status`
- `GET /api/v1/os/overview`

## Fluxo de jobs

1. criar job via `POST /api/v1/agent/jobs`
2. consultar estado em `GET /api/v1/agent/jobs`
3. iniciar execução via `POST /api/v1/agent/jobs/{job_id}/start`
4. inspecionar logs e steps persistidos

## Incidentes comuns

- Ollama indisponível: validar serviço local e `OLLAMA_URL`
- frontend sem conectar: revisar `NEXT_PUBLIC_API_URL`
- autenticação falhando: revisar `AURA_AUTH_MODE`, token e credenciais Supabase
- ações bloqueadas: verificar allowlist, regras do `CommandService` e trilha de auditoria

## Princípio de resposta

Toda intervenção deve preservar rastreabilidade, minimizar impacto lateral e evitar bypass de controles de segurança.
