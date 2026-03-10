# Deployment Guide

## Estratégia oficial

- GitHub como origem principal
- Vercel para o frontend `Next.js`
- Supabase para dados, auth e storage futuro
- FastAPI continua como camada principal de orquestração

## Sequência recomendada

1. Suba o repositório para o GitHub.
2. Crie o projeto Supabase e aplique `infra/supabase/schema.sql`.
3. Aplique `infra/supabase/seed.sql` se quiser começar com dados base.
4. Configure as variáveis do backend.
5. Configure as variáveis do frontend na Vercel.
6. Faça o deploy do frontend.
7. Se o backend permanecer local, exponha-o por tunnel seguro.

## Ambiente local + cloud

- Local-first continua suportado sem Supabase.
- Com Supabase habilitado, a Aura sincroniza projetos, settings, sessões e auditoria sem remover o fallback local.
- O backend não foi empurrado para dentro do Supabase; apenas consome seus serviços gerenciados.
- Jobs autônomos continuam locais por design, para manter a execução real no seu Mac.
