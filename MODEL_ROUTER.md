# Multi-LLM Router v1

## Providers

- Ollama
- OpenAI
- Anthropic

## Config

- [`config/models.yaml`](/Users/user_pc/Projetos/aura_v1/config/models.yaml)
- [`aura/backend/app/aura_os/integrations/model_router.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/integrations/model_router.py)

## Current routing rules

- `developer` / `coding` / `reasoning` -> `anthropic`
- `conversation` -> `openai`
- `system` / `local` -> `ollama`
- `research` -> `ollama`

## Current runtime behavior

- Ollama provider is active and usable
- OpenAI / Anthropic providers are now first-class runtime modules
- external transport for OpenAI / Anthropic is intentionally left disabled until credentials are provided
