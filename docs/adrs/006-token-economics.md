# ADR-006: Token Economics & Cost Control

## Status
Aceito — 2026-03-21

## Contexto
Cada chamada ao Claude API custa dinheiro. Sem controle:
- Um loop de raciocínio pode queimar R$500 em uma tarde
- Context window crescente = mais tokens = mais custo por request
- Sem visibilidade de gasto, Gregory descobre o prejuízo no fim do mês

## Decisão

### Budget Tiers
```
GREEN  (< 70%)  → Opera normal com modelo preferido
YELLOW (70-90%) → Loga warning, downgrade pra modelo mais barato
RED    (90-100%)→ Só ações críticas, Gregory notificado
BLOCKED (>100%) → Para tudo, responde com cache
```

### Limites Default
- Diário: $5.00 USD (~R$25)
- Mensal: $100.00 USD (~R$500)
- Configurável em runtime pelo Gregory

### Model Auto-Downgrade
| Tier | Opus | Sonnet | Haiku |
|------|------|--------|-------|
| Green | ✅ usa | ✅ usa | ✅ usa |
| Yellow | → Sonnet | ✅ usa | ✅ usa |
| Red | → Haiku | → Haiku | ✅ usa |

### Pre-flight Cost Check
ANTES de cada chamada à API:
1. Estimar tokens de input (mensagens + context)
2. Estimar tokens de output (~50% do input como heurística)
3. Calcular custo estimado com preços do modelo
4. Verificar se cabe no budget
5. Se não cabe → degradar modelo ou recusar

### Token Usage Tracking
Cada chamada registra: modelo, input tokens, output tokens, custo em USD.
Aggregado por dia e mês. Disponível no health check.

## Consequências

### Positivas
- Gregory nunca tem surpresa na fatura
- Auto-downgrade é transparente e gradual
- Dados de uso permitem otimizar prompts e reduzir custo
- Budget reset automático (diário e mensal)

### Negativas
- Downgrade de modelo pode reduzir qualidade de resposta
- Pre-flight estimate não é 100% preciso (output tokens são imprevisíveis)
- Precisa atualizar tabela de preços quando Anthropic muda pricing
