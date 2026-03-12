# AuthZ Matrix

## Perfis

- `user`: operador autenticado da sessao
- `assistant-runtime`: runtime que propoe ou coordena acoes
- `tool-runner`: executor mediado de tools aprovadas
- `admin`: manutencao e configuracao sensivel
- `system-jobs`: jobs persistidos aprovados
- `integration-service`: conta de integracao externa

## Matriz

| Capacidade | user | assistant-runtime | tool-runner | admin | system-jobs | integration-service |
|---|---|---|---|---|---|---|
| Ler status | Sim | Sim | N/A | Sim | Sim | Limitado |
| Conversar | Sim | Sim | N/A | Sim | Nao | Nao |
| Sugerir tool | Sim | Sim | N/A | Sim | Sim | Nao |
| Executar command allowlist | Mediado | Mediado | Sim | Sim | Sim | Nao |
| Ler filesystem permitido | Mediado | Mediado | Sim | Sim | Limitado | Nao |
| Abrir browser/url | Mediado | Mediado | Sim | Sim | Limitado | Nao |
| Alterar configuracao | Nao | Nao | Nao | Sim | Nao | Nao |
| Gerir segredos | Nao | Nao | Nao | Sim | Nao | Nao |

## Diretriz

Negar por padrao. Toda autorizacao deve ocorrer no servidor e ser contextual ao tipo de rota, tool e impacto operacional.
