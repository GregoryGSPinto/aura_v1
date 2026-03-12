# Secure SDLC

## Base

Alinhado ao NIST SSDF, o SDLC de Aura deve incluir requisitos de seguranca desde design ate operacao.

## Controles minimos

- threat modeling em mudancas sensiveis
- code review obrigatoria para auth, tools, memoria e CI
- secret scanning
- dependency review
- testes de regressao de autorizacao
- gates de build para falhas de seguranca relevantes

## Mudancas sensiveis

- execucao de comandos
- integracao com provedores externos
- auth/authz
- persistencia de memoria e logs
- alteracoes em CI/CD e deploy
