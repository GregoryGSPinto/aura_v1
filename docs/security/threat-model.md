# Threat Model

## Trust boundaries

1. usuario -> frontend
2. frontend -> backend API
3. backend -> providers LLM
4. backend -> tools locais
5. backend -> memoria/persistencia
6. backend -> integracoes externas

## Ameacas principais

| Superficie | Ameaca | Impacto | Probabilidade | Severidade | Resposta |
|---|---:|---:|---:|---:|---|
| API auth | token fraco ou reutilizado | Alto | Medio | Alto | rotacao, segredo forte, MFA para fluxos sensiveis |
| Chat -> tools | prompt/tool injection | Alto | Alto | Critico | policy engine, allowlists e confirmacao humana |
| Tools/filesystem | path traversal | Alto | Medio | Alto | roots permitidas e validacao de path |
| Tools/projects | script arbitrario | Alto | Medio | Alto | restringir scripts a allowlist |
| Browser tool | esquemas inseguros | Medio | Medio | Medio | permitir apenas `http/https` |
| Audit logs | leakage de segredos | Alto | Medio | Alto | sanitizacao de params e outputs |
| CORS/frontend | origem ampla e uso indevido | Alto | Medio | Alto | origins explicitas e headers seguros |
| CI/CD | segredo vazado ou dependencia comprometida | Alto | Medio | Alto | secret scanning, dependency review, SCA |

## Fluxos de alto risco

- `POST /api/v1/chat` quando aciona comando real
- `POST /api/v1/command`
- `POST /api/v1/tools/*`
- `POST /api/v1/agent/jobs/*`
- `POST /api/v1/os/agent/execute`
