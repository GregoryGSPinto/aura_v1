# Prompt para o Claude Code — Escaneamento Completo da Aura

Cole isso no Claude Code dentro do diretório raiz do projeto Aura:

---

```
Você é um auditor técnico sênior. Escaneie este projeto inteiro e me entregue um relatório estruturado COMPLETO. Não pule nada. Não resuma — seja exaustivo.

## FASE 1: Mapeamento de Estrutura
Execute: find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -name '*.lock' | head -200

Depois leia CADA arquivo encontrado. Sim, cada um. Use cat ou bat pra ler o conteúdo completo.

## FASE 2: Relatório — me entregue EXATAMENTE isto:

### 1. ÁRVORE DE DIRETÓRIOS
Mostre a árvore completa com anotações do que cada pasta/arquivo faz.

### 2. CONTRATOS E INTERFACES
Liste TODAS as interfaces TypeScript (IBrain, IBody, IAura, etc).
Para cada uma:
- Nome
- Métodos com assinaturas completas
- Tipos customizados usados
- Quem implementa essa interface

### 3. MÓDULOS CORE
Para cada módulo em packages/aura-core/src/:
- Propósito (1 linha)
- Classes exportadas
- Métodos públicos com assinaturas
- Dependências internas (o que importa de outros módulos)
- Padrões de design usados (circuit breaker, retry, pub/sub, etc)

### 4. AUTONOMY GUARD
Análise completa:
- Todos os L3 patterns (liste cada regex e categoria)
- Todos os L2 patterns
- Lógica de promoção L2→L1
- Lógica de bloqueio de promoção L3
- Cobertura de testes (quais cenários estão testados)

### 5. MEMORY ENGINE
- Schema completo de todas as tabelas (SQL)
- Métodos de CRUD
- Lógica de export/import
- Checksum de integridade
- Confidence decay logic

### 6. TOKEN BUDGET
- Tiers (green/yellow/red/blocked) com thresholds
- Lógica de auto-downgrade de modelo
- Tabela de preços por modelo
- Pre-flight cost check flow

### 7. BRAIN PLUGIN (Claude)
- System prompt atual da Aura (copie INTEIRO)
- Como o contexto é construído (buildSystemPrompt)
- Como mensagens são formatadas pra API
- Modelo default e configurações

### 8. BODY PLUGIN (OpenClaw)
- Status atual (implementado ou placeholder?)
- Skills mapeadas
- Integração com Autonomy Guard

### 9. WEB INTERFACE
- Stack (React? Vite? etc)
- Componentes existentes
- Voice integration (Web Speech API)
- Fluxo de interação completo
- System prompt usado na interface

### 10. ADRs (Architecture Decision Records)
Para cada ADR:
- Número e título
- Status
- Decisão resumida (3 linhas max)
- Consequências positivas e negativas

### 11. CONFIGURAÇÃO E DEPLOY
- package.json(s) — scripts, dependências
- tsconfig(s)
- vercel.json / deploy config
- Variáveis de ambiente necessárias

### 12. GAPS E INCONSISTÊNCIAS
Liste TUDO que está:
- Declarado mas não implementado
- Importado mas não existe
- Testado parcialmente
- Configurado mas sem uso
- Inconsistente entre módulos (ex: interface diz X mas implementação faz Y)

### 13. FLUXO COMPLETO DE UM REQUEST
Trace o caminho completo de quando Gregory fala "busca vagas de AI architect":
1. Onde entra (web interface)
2. Como chega no Aura Core
3. Como vai pro Brain
4. Como o Brain responde
5. Como o Guard classifica
6. Como o Body executa (ou enfileira)
7. Como volta pro Gregory
8. O que é salvo na memória

### 14. SYSTEM PROMPTS
Copie TODOS os system prompts que existem no projeto, de qualquer arquivo.
Inclua o path do arquivo onde cada um está.

## REGRAS:
- NÃO resuma código — mostre assinaturas completas
- NÃO pule arquivos — leia tudo
- NÃO assuma — se algo não existe, diga "NÃO ENCONTRADO"
- Se um arquivo tem mais de 500 linhas, mostre as primeiras 50, últimas 50, e liste todas as funções/classes/exports do meio
- Formate tudo em markdown limpo
- No final, me dê um JSON com a contagem: { files, interfaces, classes, methods, tests, adrs, lines_of_code }
```

---

Depois que o Claude Code te devolver esse relatório, cola ele aqui que eu construo o prompt absoluto respeitando EXATAMENTE o que existe.
