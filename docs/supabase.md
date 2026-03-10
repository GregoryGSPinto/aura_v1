# Supabase Setup

## Objetivo

Usar Supabase como camada de dados e auth sem descaracterizar a arquitetura local-first da Aura.

## Variáveis de ambiente do backend

- `AURA_SUPABASE_ENABLED=true`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_DB_PASSWORD=...` quando necessário para operações SQL diretas ou automações futuras

## Como aplicar o schema

1. Abra o painel do Supabase.
2. Vá em `SQL Editor`.
3. Execute `infra/supabase/schema.sql`.
4. Execute `infra/supabase/seed.sql` se quiser seed inicial.

## Como a Aura usa o Supabase

- `aura_projects`: catálogo principal de projetos
- `aura_settings`: settings operacionais
- `aura_audit_logs`: trilha de auditoria dos comandos
- `aura_chat_sessions`: sessões de chat
- `aura_chat_messages`: mensagens persistidas

## Auth

- O backend suporta `AURA_AUTH_MODE=local`, `supabase` ou `dual`.
- Em `dual`, o token simples local continua aceito e tokens Supabase também.
- A `service role` fica somente no backend.
- O frontend nunca recebe a `service role`.

## RLS

- O schema já habilita RLS.
- O backend usa `service role`, então não depende de policies para operar.
- Foram deixadas policies iniciais para leitura de sessões/mensagens pelo dono autenticado.

