#!/bin/bash

# deploy.sh - Script de deploy automatizado da Aura para Vercel
# Fluxo: Local Build → Git Commit → Git Push → Vercel Deploy

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy da Aura..."

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# 1. VERIFICAÇÕES INICIAIS
# ============================================
echo -e "${BLUE}🔍 Verificações iniciais...${NC}"

# Verificar diretório
if [ ! -d "aura/frontend" ]; then
    echo -e "${RED}❌ Erro: Diretório aura/frontend não encontrado${NC}"
    echo "   Execute este script da raiz do projeto aura_v1"
    exit 1
fi

# Verificar pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm não encontrado${NC}"
    echo "   Instale: npm install -g pnpm"
    exit 1
fi

# Verificar git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git não encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}   ✓ Verificações OK${NC}"

# ============================================
# 2. LOCAL BUILD
# ============================================
echo ""
echo -e "${YELLOW}📦 Etapa 1/5: Local Build...${NC}"
cd aura/frontend

# Limpar builds anteriores
echo "   → Limpando builds anteriores..."
rm -rf dist .next

# Instalar dependências
echo "   → Instalando dependências..."
pnpm install

# Type check
echo "   → Verificando tipos..."
pnpm typecheck 2>/dev/null || echo "   ⚠️  Typecheck não disponível, pulando..."

# Build de produção
echo "   → Executando build de produção..."
pnpm build

# Verificar se build foi bem-sucedida
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build falhou: pasta dist não foi criada${NC}"
    exit 1
fi

# Contar arquivos gerados
FILE_COUNT=$(find dist -type f | wc -l)
echo -e "${GREEN}   ✓ Build local completo (${FILE_COUNT} arquivos gerados)${NC}"

# ============================================
# 3. GIT ADD
# ============================================
echo ""
echo -e "${YELLOW}📤 Etapa 2/5: Git Add...${NC}"
cd ../..

# Adicionar arquivos do frontend
git add aura/frontend/

# Verificar se há mudanças para commitar
if git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Nenhuma mudança detectada para commitar${NC}"
    echo "   Faça alterações antes de deployar"
    exit 0
fi

# Mostrar o que será commitado
echo "   → Arquivos a serem commitados:"
git diff --cached --stat | head -20

echo -e "${GREEN}   ✓ Arquivos adicionados ao staging${NC}"

# ============================================
# 4. GIT COMMIT
# ============================================
echo ""
echo -e "${YELLOW}📝 Etapa 3/5: Git Commit...${NC}"

# Mensagem padrão ou argumento passado
if [ -n "$1" ]; then
    MESSAGE="$1"
else
    MESSAGE="deploy: atualiza frontend $(date '+%Y-%m-%d %H:%M')"
fi

echo "   → Mensagem: $MESSAGE"

git commit -m "$MESSAGE"

echo -e "${GREEN}   ✓ Commit criado${NC}"

# ============================================
# 5. GIT PUSH
# ============================================
echo ""
echo -e "${YELLOW}🚀 Etapa 4/5: Git Push...${NC}"

# Obter branch atual
CURRENT_BRANCH=$(git branch --show-current)
echo "   → Branch atual: $CURRENT_BRANCH"

# Push
git push origin "$CURRENT_BRANCH"

echo -e "${GREEN}   ✓ Push completo para origin/$CURRENT_BRANCH${NC}"

# ============================================
# 6. VERCEL BUILD (Automático)
# ============================================
echo ""
echo -e "${YELLOW}⏳ Etapa 5/5: Vercel Build & Deploy...${NC}"
echo ""
echo "   O Vercel detectará o push automaticamente e iniciará o build."
echo ""
echo "   📊 Status pode ser acompanhado em:"
echo "      https://vercel.com/dashboard"
echo ""

# Se for branch main, mostrar URL de produção
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "   🌐 URL de Produção: https://aura-v1.vercel.app"
else
    echo "   🔍 URL de Preview será gerada pelo Vercel"
fi

# ============================================
# RESUMO
# ============================================
echo ""
echo "========================================"
echo -e "${GREEN}✅ Deploy iniciado com sucesso!${NC}"
echo "========================================"
echo ""
echo "📋 Resumo do Deploy:"
echo "   ┌─────────────────────────────────────┐"
echo "   │  ✓ Build local                      │"
echo "   │  ✓ Git add                          │"
echo "   │  ✓ Git commit                       │"
echo "   │  ✓ Git push                         │"
echo "   │  ⏳ Vercel build (automático)       │"
echo "   └─────────────────────────────────────┘"
echo ""
echo "🌐 URLs:"
echo "   • Produção:  https://aura-v1.vercel.app"
echo "   • Dashboard: https://vercel.com/dashboard"
echo ""
echo -e "${BLUE}💡 Dica:${NC} Use './deploy.sh \"mensagem\"' para commits descritivos"
echo ""
