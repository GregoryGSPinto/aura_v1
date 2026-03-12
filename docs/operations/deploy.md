# Deploy e Operação de Ambiente

## Estratégia operacional

Aura foi projetada para rodar de forma completa em modo local-first e expandir para cenários cloud-ready sem deslocar a execução operacional crítica para fora da máquina do usuário.

## Modos de implantação

- `local-first`: frontend e backend locais, Ollama local, persistência em JSON
- `cloud-ready`: frontend publicado e serviços gerenciados para persistência e autenticação
- `hybrid`: frontend remoto com backend ainda local ou privado, exposto por túnel seguro

## Variáveis de ambiente do backend

```env
AURA_ENV=development
AURA_VERSION=1.1.0
AURA_API_PREFIX=/api/v1
AURA_AUTH_MODE=local
AURA_AUTH_TOKEN=change-me
AURA_REQUIRE_AUTH=true
AURA_MODEL=qwen3.5:9b
OLLAMA_URL=http://localhost:11434
AURA_SUPABASE_ENABLED=false
```

## Variáveis de ambiente do frontend

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_AURA_ENV=local
NEXT_PUBLIC_AURA_TOKEN=change-me
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Execução local

```bash
./scripts/run-backend
./scripts/run-frontend
```

## Publicação do frontend

O frontend foi estruturado para Vercel com `aura/frontend` como diretório raiz do app.

Passos recomendados:

1. configurar variáveis do frontend no ambiente de deploy
2. executar `pnpm build` em `aura/frontend`
3. publicar em Vercel
4. apontar `NEXT_PUBLIC_API_URL` para o backend correspondente

## Supabase

Supabase é opcional e funciona como camada complementar para dados e autenticação.

Passos mínimos:

1. aplicar `infra/supabase/schema.sql`
2. opcionalmente aplicar `infra/supabase/seed.sql`
3. configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
4. ativar `AURA_SUPABASE_ENABLED=true`
5. ajustar `AURA_AUTH_MODE=supabase` ou `dual`

## Diretrizes operacionais

- prefira segredos por ambiente, nunca em arquivos versionados
- mantenha backend e frontend desacoplados por configuração
- trate backend local exposto externamente como superfície sensível
- preserve fallback local quando serviços remotos não estiverem disponíveis
