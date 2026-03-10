# Aura Usability Testing

## Objetivo

Testar a Aura operando o seu Mac real com segurança, preservando a arquitetura local-first.

## Estratégia escolhida

Usar `Tailscale` como rede privada entre:

- Mac que roda o backend da Aura
- iPhone usado para teste
- frontend publicado na Vercel apontando para o backend privado via tailnet

## Por que esta estratégia

- evita expor a API do seu Mac publicamente
- mantém o backend rodando no próprio Mac, onde os comandos realmente executam
- funciona bem para teste real de usabilidade no navegador do iPhone
- exige menos superfície de ataque do que abrir portas ou usar túnel público sem controle

## Fluxo

1. O backend FastAPI roda no seu Mac em `127.0.0.1:8000`.
2. O Tailscale publica esse backend apenas dentro da sua tailnet.
3. O frontend da Vercel faz requests para a URL privada do Tailscale.
4. No iPhone, com Tailscale ativo, você acessa o frontend publicado e testa a Aura.

## Instalação do Tailscale

### Mac

```bash
brew install --cask tailscale
open -a Tailscale
```

Faça login na mesma conta/tailnet que será usada no iPhone.

### iPhone

1. Instale o app Tailscale na App Store.
2. Faça login na mesma conta/tailnet.
3. Ative a VPN do Tailscale.

## Subir o backend no Mac

```bash
cd /Users/user_pc/Projetos/aura_v1
scripts/run-backend-private
```

## Publicar o backend dentro da tailnet

Depois de autenticar o Tailscale no Mac:

```bash
tailscale serve https / http://127.0.0.1:8000
tailscale status --json
```

O hostname final costuma seguir o padrão:

```text
https://<nome-da-maquina>.<tailnet>.ts.net
```

A API da Aura ficará em:

```text
https://<nome-da-maquina>.<tailnet>.ts.net/api/v1
```

## Configurar o backend para aceitar o frontend publicado

No `aura/backend/.env`, ajuste:

```env
AURA_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://frontend-sage-two-xaqynrwxwt.vercel.app
```

Se você trocar a URL final da Vercel, atualize esse valor.

## Configurar a Vercel para apontar para o Mac

No projeto da Vercel, configure:

```env
NEXT_PUBLIC_API_URL=https://<nome-da-maquina>.<tailnet>.ts.net/api/v1
NEXT_PUBLIC_AURA_ENV=production
NEXT_PUBLIC_AURA_TOKEN=<token-local-ou-token-cloud>
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Depois rode novo deploy:

```bash
cd /Users/user_pc/Projetos/aura_v1/aura/frontend
vercel --prod --yes
```

## Teste prático no iPhone

1. Ative o Tailscale no iPhone.
2. Abra `https://frontend-sage-two-xaqynrwxwt.vercel.app`.
3. Verifique o card de status da Aura.
4. Faça os testes nesta ordem:

- consultar status
- listar projetos
- abrir um projeto seguro
- executar `list_projects`
- executar `git_status`

## Sequência recomendada de teste

### 1. Status

Pergunta:

```text
Me dê o status operacional da Aura.
```

### 2. Projetos

Pergunta:

```text
Quais projetos estão disponíveis?
```

### 3. Abrir projeto

Use a ação da UI ou:

```text
Abra o projeto aura_v1.
```

### 4. Teste de comando seguro

```text
Quero o status do git do projeto principal.
```

## Limitações desta fase

- o backend continua rodando localmente no seu Mac
- o frontend publicado depende de você estar na tailnet para alcançar a API privada
- autenticação ainda depende do modo configurado no backend (`local`, `dual` ou `supabase`)
- o executor de comandos continua restrito à whitelist da v1

## Checklist rápido

- backend rodando no Mac
- Ollama ativo no Mac
- Tailscale ativo no Mac
- Tailscale ativo no iPhone
- Vercel apontando para a URL `ts.net`
- `AURA_ALLOWED_ORIGINS` inclui a URL final da Vercel

