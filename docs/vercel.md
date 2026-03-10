# Vercel Setup

## Root Directory

`aura/frontend`

## Variáveis de ambiente

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AURA_ENV=production`
- `NEXT_PUBLIC_AURA_TOKEN` se o backend continuar em token simples
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Valores a preencher

```env
NEXT_PUBLIC_API_URL=https://<hostname-tailscale-ou-backend-remoto>/api/v1
NEXT_PUBLIC_AURA_ENV=production
NEXT_PUBLIC_AURA_TOKEN=<token-da-aura-se-usar-modo-local-ou-dual>
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Comandos exatos

```bash
cd /Users/user_pc/Projetos/aura_v1/aura/frontend
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_AURA_ENV production
vercel env add NEXT_PUBLIC_AURA_TOKEN production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod --yes
```

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
