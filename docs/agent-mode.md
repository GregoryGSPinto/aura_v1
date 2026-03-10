# Aura Agent Mode

## Módulos

- `app/agents/planner.py`
- `app/agents/job_manager.py`
- `app/agents/step_executor.py`
- `app/agents/models.py`
- `app/services/job_service.py`

## Fluxo

1. usuário envia uma meta para `POST /api/v1/agent/jobs`
2. planner gera um plano seguro usando apenas comandos da whitelist
3. job manager cria o job persistido
4. job pode ser iniciado via `POST /api/v1/agent/jobs/{job_id}/start`
5. worker local executa os steps no Mac
6. progresso, logs e resultado ficam persistidos

## Endpoints

- `POST /api/v1/agent/jobs`
- `GET /api/v1/agent/jobs`
- `GET /api/v1/agent/jobs/{job_id}`
- `POST /api/v1/agent/jobs/{job_id}/start`
- `POST /api/v1/agent/jobs/{job_id}/cancel`
- `GET /api/v1/agent/jobs/{job_id}/steps`

## Regras

- sem shell arbitrário
- apenas whitelist
- planner bloqueia metas que peçam ações fora da whitelist
- execução local no Mac
- auditoria e logs persistidos

## Limitação atual

O planner ainda é heurístico. Ele já cria planos seguros e úteis, mas ainda não executa revisão/correção de código ou lint/build/testes fora da whitelist aprovada.
