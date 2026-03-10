# 🚀 Guia de Deploy - Aura Frontend

Fluxo de deploy automatizado: **Local → Git → Vercel**

---

## 📋 Visão do Fluxo

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Local      │────▶│   Git       │────▶│   GitHub    │────▶│   Vercel    │────▶│   Site      │
│  Build      │     │   Commit    │     │   Push      │     │   Build     │     │   No Ar     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼
  pnpm build          git add            git push           Auto build         aura-v1.vercel.app
  pnpm test           git commit         (main branch)      & deploy
```

---

## ⚙️ Configuração Atual

### `next.config.ts`
```typescript
const nextConfig = {
  output: 'export',        // Exportação estática
  distDir: 'dist',         // Diretório de saída
  images: { unoptimized: true },
  trailingSlash: true,
};
```

### `vercel.json`
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install"
}
```

---

## 🔄 Fluxo de Deploy Passo a Passo

### 1. LOCAL BUILD (Testar antes de commitar)

```bash
# Navegar ao frontend
cd aura/frontend

# Instalar dependências (se necessário)
pnpm install

# Build de produção
pnpm build

# Verificar se há erros
pnpm lint

# Testes (se houver)
pnpm test
```

**✅ Sucesso quando:**
- Build completa sem erros
- Pasta `dist/` é criada
- Arquivos estáticos gerados

---

### 2. GIT COMMIT (Versionar mudanças)

```bash
# Do diretório raiz do projeto
cd /Users/user_pc/Projetos/aura_v1

# Verificar status
git status

# Adicionar mudanças do frontend
git add aura/frontend/

# Commit descritivo
git commit -m "feat: descreva as mudanças

- O que mudou
- Por que mudou
- Como testar"
```

---

### 3. GIT PUSH (Enviar para GitHub)

```bash
# Enviar para branch main
git push origin main

# Ou se estiver em outra branch
git push origin nome-da-branch
```

---

### 4. VERCEL BUILD (Automático)

O Vercel detecta automaticamente:
1. Push para GitHub
2. Arquivos modificados
3. Executa build
4. Gera preview (branches) ou produção (main)

**Acompanhar em:** https://vercel.com/dashboard

---

### 5. DEPLOY ATUALIZADO 🎉

**URL de Produção:** `https://aura-v1.vercel.app`

---

## 🛠️ Script de Automação

Criar arquivo `deploy.sh`:

```bash
#!/bin/bash

# deploy.sh - Script de deploy automatizado

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy da Aura..."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar diretório
if [ ! -d "aura/frontend" ]; then
    echo -e "${RED}❌ Erro: Diretório aura/frontend não encontrado${NC}"
    exit 1
fi

# 2. Local Build
echo -e "${YELLOW}📦 Etapa 1/5: Local Build...${NC}"
cd aura/frontend

# Verificar pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm não encontrado. Instale: npm install -g pnpm${NC}"
    exit 1
fi

# Instalar dependências
echo "   → Instalando dependências..."
pnpm install

# Build
echo "   → Executando build..."
pnpm build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build falhou: pasta dist não criada${NC}"
    exit 1
fi

echo -e "${GREEN}   ✓ Build local completo${NC}"

# 3. Git Add
echo -e "${YELLOW}📤 Etapa 2/5: Git Add...${NC}"
cd ../..

git add aura/frontend/

# Verificar se há mudanças para commitar
if git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Nenhuma mudança para commitar${NC}"
    exit 0
fi

echo -e "${GREEN}   ✓ Arquivos adicionados${NC}"

# 4. Git Commit
echo -e "${YELLOW}📝 Etapa 3/5: Git Commit...${NC}"

# Mensagem padrão ou argumento
MESSAGE=${1:-"update: deploy frontend $(date +%Y-%m-%d-%H:%M)"}

git commit -m "$MESSAGE"

echo -e "${GREEN}   ✓ Commit criado: $MESSAGE${NC}"

# 5. Git Push
echo -e "${YELLOW}🚀 Etapa 4/5: Git Push...${NC}"
git push origin main

echo -e "${GREEN}   ✓ Push completo${NC}"

# 6. Vercel Build (automático)
echo -e "${YELLOW}⏳ Etapa 5/5: Aguardando Vercel...${NC}"
echo "   O Vercel detectará o push automaticamente"
echo "   Acompanhe em: https://vercel.com/dashboard"

echo ""
echo -e "${GREEN}✅ Deploy iniciado com sucesso!${NC}"
echo ""
echo "📋 Resumo:"
echo "   • Build local: ✓"
echo "   • Commit: ✓"
echo "   • Push: ✓"
echo "   • Vercel build: em andamento..."
echo ""
echo "🌐 URLs:"
echo "   • Produção: https://aura-v1.vercel.app"
echo "   • Dashboard: https://vercel.com/dashboard"
```

### Tornar executável:
```bash
chmod +x deploy.sh
```

### Uso:
```bash
# Deploy rápido (mensagem automática)
./deploy.sh

# Deploy com mensagem customizada
./deploy.sh "feat: adiciona novo componente de chat"
```

---

## 📁 Estrutura de Deploy

```
aura_v1/
├── aura/
│   └── frontend/
│       ├── app/              # Código fonte
│       ├── components/       # Componentes
│       ├── lib/              # Utilidades
│       ├── dist/             # BUILD OUTPUT (gerado)
│       ├── next.config.ts    # Config Next.js
│       └── vercel.json       # Config Vercel
├── deploy.sh                 # Script de deploy
└── DEPLOY_GUIDE.md           # Este guia
```

---

## 🔧 Configuração no Vercel Dashboard

### Settings → General

| Campo | Valor |
|-------|-------|
| **Framework Preset** | `Next.js` |
| **Root Directory** | `aura/frontend` |
| **Build Command** | `pnpm build` |
| **Output Directory** | `dist` |
| **Install Command** | `pnpm install` |

### Environment Variables

Adicionar em Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🚨 Troubleshooting

### Erro: "Build failed"
```bash
# Limpar cache e reinstalar
cd aura/frontend
rm -rf node_modules dist .next
pnpm install
pnpm build
```

### Erro: "404 on refresh"
```bash
# Verificar next.config.ts
echo "trailingSlash: true deve estar configurado"
```

### Erro: "Images not loading"
```bash
# Verificar configuração de imagens
echo "images: { unoptimized: true } no next.config.ts"
```

### Erro: "Git push rejected"
```bash
# Pull antes de push
git pull origin main --rebase
git push origin main
```

---

## 🎯 Checklist Pré-Deploy

- [ ] `pnpm build` completa sem erros
- [ ] Pasta `dist/` criada com arquivos
- [ ] `git status` mostra mudanças esperadas
- [ ] Commit message descritiva
- [ ] Push para `main` (produção) ou branch (preview)
- [ ] Vercel dashboard mostra build em progresso
- [ ] Site acessível na URL

---

## 🌿 Deploy de Branches (Preview)

```bash
# Criar branch de feature
git checkout -b feature/nova-ui

# Desenvolver e commitar
git add .
git commit -m "feat: nova interface"

# Push para GitHub (cria preview no Vercel)
git push origin feature/nova-ui
```

O Vercel gera automaticamente:
- **Preview URL:** `https://aura-v1-git-feature-nova-ui.vercel.app`
- **Comentário no PR** com link

---

## 📝 Comandos Rápidos

```bash
# Deploy completo em um comando
./deploy.sh "mensagem do commit"

# Ou manualmente:
cd aura/frontend && pnpm build && cd ../.. && git add aura/frontend/ && git commit -m "deploy" && git push

# Ver status do deploy no Vercel CLI (se instalado)
vercel --version
vercel --prod
```

---

## ✨ Dicas

1. **Sempre faça build local primeiro** - Captura erros antes do push
2. **Commits atômicos** - Um commit por feature/fix
3. **Branches para features** - Use preview antes de mergear
4. **Monitore o Vercel** - Dashboard mostra logs detalhados

---

**Pronto para deploy!** 🚀
