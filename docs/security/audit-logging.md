# Audit Logging

## Eventos obrigatorios

- login e falha de login
- command execution
- uso de tools
- falha de policy
- alteracoes administrativas
- eventos de integracao

## Campos minimos

- timestamp
- actor_id
- request_id
- command ou action
- status
- metadata sanitizada

## Regra

Logs devem ser uteis para investigacao, pesquisaveis e nunca carregar segredos em claro.
