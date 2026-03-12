# Aura OS Runtime

## Modelo operacional

Aura OS organiza a operação em cinco estágios:

1. `perceive`
2. `reason`
3. `plan`
4. `act`
5. `learn`

Esse ciclo permite transformar metas em planos estruturados, planos em jobs persistidos e jobs em ações aprovadas e auditáveis.

## Módulos centrais

- `app.aura_os.core.agent.AuraOperatingSystem`
- `app.aura_os.core.agent_loop.AgentLoop`
- `app.agents.planner.AgentPlanner`
- `app.agents.job_manager.AgentJobManager`
- `app.agents.step_executor.AgentStepExecutor`
- `app.aura_os.agents.router.AgentRouter`

## Subdomínios

- `core`: cognição, reasoner, planner adapter, roteamento e execução controlada
- `agents`: agentes especializados e roteamento por perfil de tarefa
- `memory`: memória de curto prazo, longo prazo, vetorial e manager
- `tools`: registro, permissões e runtimes de ferramenta
- `voice`: microfone, wake word, STT, TTS e bridge
- `integrations`: provedores de modelo e model router
- `automation`: ações, workflows e scheduler

## Jobs e execução

O fluxo operacional de jobs segue um padrão seguro:

1. usuário envia uma meta
2. o planner cria um plano restrito a capacidades aprovadas
3. o job manager persiste o job
4. o step executor delega cada ação ao `CommandService`
5. logs e resultados ficam auditáveis

## Estado atual

- runtime principal ativo no backend
- jobs persistidos em modo local-first
- research runtime e voice runtime preparados como módulos canônicos
- execução real protegida por allowlist, validação e auditoria
