/**
 * AURA CORE — The Consciousness
 *
 * Este é o arquivo mais importante do sistema inteiro.
 * Aura Core orquestra:
 * - Brain (Claude API) pra raciocinar
 * - Body (OpenClaw) pra executar
 * - MemoryEngine pra lembrar
 * - AutonomyGuard pra proteger
 * - TokenBudget pra controlar custos
 * - CircuitBreaker pra resiliência
 * - Logger pra observabilidade
 * - EventBus pra comunicação desacoplada
 *
 * PRINCÍPIO: "Aura existe pra fazer Gregory VIVER mais, não produzir mais."
 *
 * @author Gregory — AI Solution Architect
 * @see ADR-001: Arquitetura Plugável em Três Camadas
 */

import { randomUUID } from 'crypto';
import type {
  IAura,
  IBrain,
  IBody,
  Channel,
  Action,
  AuraResponse,
  ExecutedAction,
  KnowledgeCategory,
  KnowledgeEntry,
  AuraMemoryExport,
  SystemHealth,
  TokenBudget,
  TokenCost,
  RequestContext,
  IEventBus,
} from './interfaces.js';
import { AutonomyGuard } from './autonomy-guard.js';
import { MemoryEngine } from './memory-engine.js';
import { TokenBudgetManager } from './token-budget.js';
import { CircuitBreaker } from './patterns/circuit-breaker.js';
import { withRetry } from './patterns/retry.js';
import { EventBus } from './event-bus.js';
import { Logger } from './logger.js';

// ============================================================
// CONFIGURATION
// ============================================================

export interface AuraConfig {
  brain: IBrain;
  body: IBody;
  memoryAdapter: import('./memory-engine.js').DatabaseAdapter;
  budgetConfig?: Partial<import('./token-budget.js').BudgetConfig>;
  logLevel?: import('./interfaces.js').LogLevel;
}

// ============================================================
// AURA CORE CLASS
// ============================================================

export class Aura implements IAura {
  private readonly brain: IBrain;
  private readonly body: IBody;
  private readonly memory: MemoryEngine;
  private readonly guard: AutonomyGuard;
  private readonly budget: TokenBudgetManager;
  private readonly brainCircuit: CircuitBreaker;
  private readonly bodyCircuit: CircuitBreaker;
  private readonly eventBus: IEventBus;
  private readonly logger: Logger;
  private startTime: Date;
  private currentConversationId?: string;

  constructor(config: AuraConfig) {
    this.eventBus = new EventBus();
    this.logger = new Logger({
      component: 'AuraCore',
      minLevel: config.logLevel ?? 'info',
    });

    // Core modules
    this.brain = config.brain;
    this.body = config.body;
    this.memory = new MemoryEngine(config.memoryAdapter, this.eventBus);
    this.guard = new AutonomyGuard(this.eventBus);
    this.budget = new TokenBudgetManager(config.budgetConfig, this.eventBus);

    // Resilience
    this.brainCircuit = new CircuitBreaker(
      { name: 'brain', failureThreshold: 3, cooldownMs: 30_000 },
      this.eventBus,
    );
    this.bodyCircuit = new CircuitBreaker(
      { name: 'body', failureThreshold: 5, cooldownMs: 60_000 },
      this.eventBus,
    );

    this.startTime = new Date();

    // Wire up event handlers
    this.setupEventHandlers();

    this.logger.info('Aura Core initialized', {
      brain: this.brain.providerId,
      body: this.body.executorId,
    });
  }

  /**
   * Boot sequence — conecta brain, body, inicializa memória.
   */
  async boot(): Promise<void> {
    const timer = this.logger.startTimer('Boot sequence');

    await this.memory.initialize();
    this.logger.info('Memory initialized');

    await this.brain.connect();
    this.logger.info('Brain connected', { provider: this.brain.providerId });

    await this.body.connect();
    this.logger.info('Body connected', { executor: this.body.executorId });

    this.startTime = new Date();
    timer();
  }

  /**
   * Processa input do Gregory.
   *
   * FLOW:
   * 1. Cria request context (correlation ID)
   * 2. Verifica budget (pode gastar?)
   * 3. Recupera contexto da memória
   * 4. Envia pro Brain (Claude) via CircuitBreaker
   * 5. Brain retorna resposta + ações sugeridas
   * 6. AutonomyGuard classifica cada ação
   * 7. L1 → executa via Body
   * 8. L2 → enfileira pra aprovação
   * 9. L3 → bloqueia e loga
   * 10. Salva tudo na memória
   * 11. Retorna resposta pro Gregory
   */
  async process(input: string, channel: Channel): Promise<AuraResponse> {
    const ctx = this.createContext(channel);
    const log = this.logger.withContext(ctx);
    const timer = log.startTimer('Process request');
    const startMs = Date.now();

    try {
      // 1. Start or continue conversation
      if (!this.currentConversationId) {
        this.currentConversationId = await this.memory.startConversation(channel);
      }

      // 2. Save Gregory's message
      await this.memory.addMessage(this.currentConversationId, {
        role: 'gregory',
        content: input,
        channel,
        correlationId: ctx.correlationId,
      });

      // 3. Budget check
      const estimatedCost = this.budget.estimateCost(2000, 1000, this.brain.model);
      const budgetCheck = this.budget.canSpend(estimatedCost);

      if (!budgetCheck.allowed) {
        log.warn('Budget exceeded — returning cached response', { tier: budgetCheck.tier });
        return this.createBudgetExceededResponse(ctx, startMs);
      }

      // 4. Model suggestion based on budget tier
      const suggestedModel = this.budget.suggestModel(this.brain.model);
      if (suggestedModel !== this.brain.model) {
        log.info('Model downgraded by budget', {
          preferred: this.brain.model,
          actual: suggestedModel,
          tier: budgetCheck.tier,
        });
      }

      // 5. Get memory context (token-aware)
      const knowledge = await this.memory.recall(undefined, undefined, 50);
      const recentMessages = await this.memory.getRecentContext(4000);

      // 6. Think via Brain (with circuit breaker + retry)
      const brainResponse = await this.brainCircuit.execute(() =>
        withRetry(
          () => this.brain.think(recentMessages, knowledge, this.budget.getBudget()),
          {
            maxRetries: 2,
            onRetry: (attempt, err) => {
              log.warn(`Brain retry #${attempt}`, { error: err.message });
            },
          },
        ),
      );

      // 7. Record token spend
      this.budget.recordSpend(brainResponse.tokenCost, `process: ${input.slice(0, 50)}`);
      await this.memory.recordTokenUsage(
        brainResponse.model,
        brainResponse.tokenCost.inputTokens,
        brainResponse.tokenCost.outputTokens,
        brainResponse.tokenCost.estimatedCostUSD,
      );

      // 8. Classify and handle actions
      const processedActions = await this.processActions(brainResponse.actions, ctx);

      // 9. Save Aura's response
      await this.memory.addMessage(this.currentConversationId, {
        role: 'aura',
        content: brainResponse.content,
        channel,
        correlationId: ctx.correlationId,
      });

      timer();

      return {
        message: brainResponse.content,
        actions: processedActions,
        channel,
        responseTimeMs: Date.now() - startMs,
        tokenCost: brainResponse.tokenCost,
        correlationId: ctx.correlationId,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error('Process failed', err, { input: input.slice(0, 100) });

      return {
        message: 'Desculpa Gregory, tive um problema processando isso. Tenta de novo?',
        actions: [],
        channel,
        responseTimeMs: Date.now() - startMs,
        tokenCost: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0, model: 'none', cached: false },
        correlationId: ctx.correlationId,
      };
    }
  }

  /**
   * Aprova ação L2 pendente e executa.
   */
  async approve(actionId: string): Promise<ExecutedAction> {
    this.logger.info('Action approved by Gregory', { actionId });

    await this.memory.updateActionStatus(actionId, 'approved');
    this.eventBus.emit({
      type: 'action.approved',
      payload: { id: actionId } as Action,
    });

    // Execute via Body
    const ctx = this.createContext('web');
    const result = await this.bodyCircuit.execute(() =>
      this.body.execute({ id: actionId } as Action, ctx),
    );

    const executedAction: ExecutedAction = {
      id: actionId,
      type: 'approved_action',
      description: 'Approved and executed',
      autonomyLevel: 2,
      status: result.success ? 'completed' : 'failed',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      executedAt: new Date(),
      durationMs: result.durationMs,
      correlationId: ctx.correlationId,
      output: result.output,
      tokenCost: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0, model: 'none', cached: false },
    };

    await this.memory.updateActionStatus(actionId, executedAction.status, result.output);
    this.eventBus.emit({ type: 'action.executed', payload: executedAction });

    return executedAction;
  }

  /**
   * Rejeita ação L2 pendente.
   */
  async reject(actionId: string, reason: string): Promise<Action> {
    this.logger.info('Action rejected by Gregory', { actionId, reason });
    await this.memory.updateActionStatus(actionId, 'rejected');

    const action = { id: actionId, status: 'rejected' } as Action;
    this.eventBus.emit({ type: 'action.rejected', payload: { ...action, reason } });
    return action;
  }

  async recall(category: KnowledgeCategory, query?: string): Promise<KnowledgeEntry[]> {
    return this.memory.recall(category, query);
  }

  async exportMemory(): Promise<AuraMemoryExport> {
    return this.memory.exportMemory();
  }

  async importMemory(data: AuraMemoryExport): Promise<{ imported: number; skipped: number }> {
    return this.memory.importMemory(data);
  }

  async getBudget(): Promise<TokenBudget> {
    return this.budget.getBudget();
  }

  async getHealth(): Promise<SystemHealth> {
    const [brainPing, bodyPing, memoryHealth] = await Promise.allSettled([
      this.brain.ping(),
      this.body.ping(),
      this.memory.getHealth(),
    ]);

    const brainOk = brainPing.status === 'fulfilled' && brainPing.value.ok;
    const bodyOk = bodyPing.status === 'fulfilled' && bodyPing.value.ok;
    const memOk = memoryHealth.status === 'fulfilled';

    const overallStatus = brainOk && bodyOk && memOk
      ? 'healthy'
      : brainOk || bodyOk
        ? 'degraded'
        : 'unhealthy';

    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime.getTime(),
      brain: {
        status: brainOk ? 'healthy' : 'unhealthy',
        providerId: this.brain.providerId,
        latencyMs: brainPing.status === 'fulfilled' ? brainPing.value.latencyMs : -1,
        errorRate: 0,
        consecutiveFailures: this.brainCircuit.getState().failures,
      },
      body: {
        status: bodyOk ? 'healthy' : 'unhealthy',
        providerId: this.body.executorId,
        latencyMs: bodyPing.status === 'fulfilled' ? bodyPing.value.latencyMs : -1,
        errorRate: 0,
        consecutiveFailures: this.bodyCircuit.getState().failures,
      },
      memory: memoryHealth.status === 'fulfilled'
        ? memoryHealth.value
        : { status: 'unhealthy', totalConversations: 0, totalKnowledge: 0, totalActions: 0, sizeBytes: 0, oldestEntry: new Date(), newestEntry: new Date() },
      budget: this.budget.getBudget(),
      circuitBreakers: {
        brain: this.brainCircuit.getState(),
        body: this.bodyCircuit.getState(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    this.logger.info('Aura shutting down gracefully...');

    if (this.currentConversationId) {
      await this.memory.endConversation(this.currentConversationId, 'Session ended');
    }

    await Promise.allSettled([
      this.brain.disconnect(),
      this.body.disconnect(),
      this.memory.close(),
    ]);

    this.logger.info('Aura shutdown complete. Até logo, Gregory.');
  }

  // ==== PRIVATE ====

  private async processActions(actions: Action[], ctx: RequestContext): Promise<Action[]> {
    const log = this.logger.withContext(ctx);
    const processed: Action[] = [];

    for (const action of actions) {
      const classification = this.guard.classify(action);
      action.autonomyLevel = classification.level;

      switch (classification.level) {
        case 1: {
          // Autonomous — execute directly
          log.info('L1 action — executing', { type: action.type });
          try {
            const result = await this.bodyCircuit.execute(() =>
              this.body.execute(action, ctx),
            );
            action.status = result.success ? 'completed' : 'failed';
            action.output = result.output;
          } catch (err) {
            action.status = 'failed';
            log.error('L1 action failed', err instanceof Error ? err : undefined);
          }
          break;
        }

        case 2: {
          // Needs approval
          log.info('L2 action — queued for approval', { type: action.type });
          action.status = 'pending_approval';
          break;
        }

        case 3: {
          // BLOCKED
          log.warn('L3 action BLOCKED', {
            type: action.type,
            reason: classification.reason,
          });
          action.status = 'blocked';
          break;
        }
      }

      await this.memory.recordAction(action);
      processed.push(action);
    }

    return processed;
  }

  private createContext(channel: Channel): RequestContext {
    return {
      correlationId: randomUUID(),
      traceId: randomUUID(),
      spanId: randomUUID().slice(0, 16),
      channel,
      timestamp: new Date(),
      userId: 'gregory',
    };
  }

  private createBudgetExceededResponse(ctx: RequestContext, startMs: number): AuraResponse {
    return {
      message: 'Gregory, atingi o limite de orçamento de hoje. Posso continuar amanhã, ou você pode ajustar o limite se precisar de algo urgente.',
      actions: [],
      channel: ctx.channel,
      responseTimeMs: Date.now() - startMs,
      tokenCost: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0, model: 'none', cached: false },
      correlationId: ctx.correlationId,
    };
  }

  private setupEventHandlers(): void {
    this.eventBus.on('circuit.opened', (state) => {
      this.logger.error(`Circuit OPENED: ${state.name}`, undefined, {
        failures: state.failures,
        cooldownMs: state.cooldownMs,
      });
    });

    this.eventBus.on('circuit.closed', (state) => {
      this.logger.info(`Circuit recovered: ${state.name}`);
    });

    this.eventBus.on('budget.exceeded', (budget) => {
      this.logger.fatal('BUDGET EXCEEDED', undefined, {
        daily: `$${budget.currentDailyUSD}/$${budget.dailyLimitUSD}`,
        monthly: `$${budget.currentMonthlyUSD}/$${budget.monthlyLimitUSD}`,
      });
    });

    this.eventBus.on('action.blocked', (action) => {
      this.logger.warn('Action BLOCKED by AutonomyGuard', {
        type: action.type,
        description: action.description?.slice(0, 100),
      });
    });
  }
}
