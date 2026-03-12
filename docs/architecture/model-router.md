# Model Router

## Objetivo

O model router permite selecionar provedores e modelos de acordo com o perfil da tarefa, preservando o modo local-first como base.

## Provedores suportados

- Ollama
- OpenAI
- Anthropic

## Configuração

- `config/models.yaml`
- `app/aura_os/integrations/model_router.py`

## Regras atuais

- `developer`, `coding` e `reasoning` priorizam Anthropic
- `conversation` prioriza OpenAI
- `system` e `local` priorizam Ollama
- `research` permanece orientado a Ollama no estado atual

## Estado de ativação

- Ollama é o provedor utilizável por padrão
- provedores cloud existem como módulos de primeira classe
- transporte externo depende de credenciais e habilitação explícita

## Considerações

O roteamento de modelos deve otimizar contexto, custo, latência e soberania operacional sem introduzir acoplamento rígido ao provedor.
