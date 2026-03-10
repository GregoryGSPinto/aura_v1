# Vercel Setup

Projeto a publicar: `aura/frontend`

## Build

- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output: `.next`
- Root Directory: `aura/frontend`

## Environment Variables

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AURA_ENV`
- `NEXT_PUBLIC_AURA_TOKEN` se usar modo local/token
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Observações

- O frontend pode ficar público na Vercel mesmo com o backend permanecendo local-first.
- Para apontar o frontend publicado para um backend local, use tunnel seguro.
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` na Vercel.

