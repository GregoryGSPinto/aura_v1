# AURA Agents

## Agent runtime

Aura now exposes an AI OS runtime built around five stages:

1. `perceive`
2. `reason`
3. `plan`
4. `act`
5. `learn`

## Main modules

- `app.aura_os.core.agent.AuraOperatingSystem`
- `app.aura_os.core.agent_loop.AgentLoop`
- `app.agents.planner.AgentPlanner`
- `app.agents.job_manager.AgentJobManager`
- `app.agents.step_executor.AgentStepExecutor`
- `app.aura_os.agents.router.AgentRouter`

## Operational model

- High-level goals become structured plans.
- Structured plans become persistent jobs.
- Jobs execute only approved commands.
- Every step is logged.
- Memory snapshots are recorded after execution.

## Supported goals today

- project navigation
- open VS Code
- git status
- logs inspection
- safe dev/lint/build/test flows
- system telemetry checks

## Future-ready areas

- wake word
- speech pipeline
- cloud model fallback
- vector retrieval with Chroma or pgvector
- multi-agent routing for system, developer, research, and automation modes
