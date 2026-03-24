# ADR-005: Error Handling & Resilience Strategy

## Status
Aceito — 2026-03-21

## Contexto
Aura depende de serviços externos (Claude API, OpenClaw) que VÃO falhar.
A questão não é "se", é "quando" e "como a Aura reage".

Um agente autônomo que não sabe lidar com falha é mais perigoso que útil:
- Retry infinito → queima budget, DDoS no provider
- Sem retry → uma falha transitória mata a experiência
- Sem circuit breaker → cascata de falhas derruba tudo
- Sem graceful degradation → Gregory fica sem resposta

## Decisão

### 1. Circuit Breaker Pattern
Cada dependência externa tem seu próprio circuit breaker:

```
CLOSED (normal) ─── N falhas ──→ OPEN (bloqueado)
                                    │
                              cooldown timer
                                    │
                              HALF-OPEN (teste)
                                    │
                          ┌─── sucesso ───┐
                          ▼               ▼
                       CLOSED          OPEN (volta)
```

**Brain (Claude API):**
- Threshold: 3 falhas consecutivas
- Cooldown: 30 segundos
- Quando aberto: retorna resposta cached ou "estou com dificuldade"

**Body (OpenClaw):**
- Threshold: 5 falhas consecutivas
- Cooldown: 60 segundos
- Quando aberto: enfileira ações, tenta depois

### 2. Retry com Exponential Backoff + Jitter
```
Tentativa 1: imediata
Tentativa 2: ~1s (com jitter)
Tentativa 3: ~2s (com jitter)
Tentativa 4: ~4s (com jitter)
Max: 30s entre retries
```

**Retryable:**
- 429 (rate limit)
- 500, 502, 503 (server errors)
- Timeout, network errors

**NÃO retryable:**
- 401, 403 (auth — credencial errada)
- 400, 422 (bad request — payload errado)

### 3. Dead Letter Queue
Ação que falha após todos os retries vai pra dead letter:
- Status: `dead_letter`
- Gregory é notificado
- Ação pode ser manualmente re-executada
- Audit log registra toda a história de tentativas

### 4. Graceful Degradation
| Componente | Falha | Degradação |
|------------|-------|------------|
| Brain (Claude) | Circuit open | Responde com cache, sugere tentar depois |
| Body (OpenClaw) | Circuit open | Enfileira ações, executa quando voltar |
| Memory (SQLite) | Read error | Opera sem contexto, avisa Gregory |
| Budget | Exceeded | Troca pra modelo mais barato, depois para |

### 5. Correlation IDs
Todo request recebe um `correlationId` único (UUID v4).
Toda operação durante aquele request carrega o ID.
Resultado: `grep correlationId logs.json` = timeline completa.

## Consequências

### Positivas
- Aura nunca "morre" — degrada graciosamente
- Gregory sempre recebe uma resposta (mesmo que seja "estou com dificuldade")
- Budget nunca é queimado por retry loops descontrolados
- Audit trail completo de falhas pra diagnóstico
- Cada componente falha independentemente (blast radius controlado)

### Negativas
- Overhead de ~5ms por request (circuit breaker check + context creation)
- Complexidade adicional no código (justificada pelo benefício)
- Dead letter queue precisa de UI pra Gregory gerenciar

### Métricas
- Uptime efetivo > 99% (considerando degradação como "up")
- Mean time to recovery < 60s (tempo até half-open)
- Zero retry loops infinitos (enforced por max retries + circuit breaker)
- 100% dos requests têm correlationId (enforced pelo Aura Core)
