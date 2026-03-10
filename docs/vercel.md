# Vercel Setup

## Root Directory

`aura/frontend`

## Variáveis de ambiente

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AURA_ENV=cloud`
- `NEXT_PUBLIC_AURA_TOKEN` se o backend continuar em token simples
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Comandos

```bash
cd aura/frontend
pnpm install
pnpm build
vercel
```

## Notas operacionais

- Se o backend estiver local, publique apenas o frontend e use um tunnel seguro para a API.
- Se o backend estiver remoto mais tarde, a mesma build continua válida; basta trocar `NEXT_PUBLIC_API_URL`.
- O frontend já trata ausência de env com mensagens amigáveis.

