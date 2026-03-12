# Security Overview

## Objetivo

Aura deve operar como um sistema secure-by-design, secure-by-default e auditavel. O produto combina conversa, memoria e execucao de acoes reais, portanto a seguranca precisa mediar toda capacidade operacional.

## Referencias adotadas

- OWASP ASVS
- OWASP Top 10
- NIST SSDF
- CISA Secure by Design

## Superficies criticas

- autenticacao e status de sessao
- chat com possibilidade de acao operacional
- endpoints de command, tools, jobs e Aura OS
- leitura de arquivos, browser open e execucao de scripts
- persistencia de memoria, logs e auditoria
- configuracao e segredos por ambiente
- pipeline CI/CD e dependencias

## Hardening aplicado agora

- CORS restrito a origins configuradas
- headers de seguranca no backend e frontend
- request correlation via `X-Request-ID`
- rate limiting basico para auth, chat e command
- sanitizacao de params e outputs em retornos e auditoria
- execucao de scripts de projeto limitada a allowlist segura
- browser tool restrita a `http/https`
- terminal tool com `cwd` validado contra roots permitidas

## Lacunas remanescentes

- token local ainda e um modelo simplificado de autenticacao
- nao ha RBAC/ABAC completo por perfil de tool e job
- secrets management ainda depende de env vars locais
- sandbox forte para execucao externa ainda e evolucao futura
