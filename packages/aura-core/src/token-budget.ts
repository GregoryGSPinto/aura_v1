/**
 * AURA Token Budget Manager
 *
 * Controla quanto dinheiro a Aura gasta por dia/mês.
 * Sem isso, um loop de raciocínio pode queimar R$500 em uma tarde.
 *
 * Tiers:
 * - Green: < 70% do budget → opera normal
 * - Yellow: 70-90% → loga warning, troca pra modelo mais barato
 * - Red: 90-100% → só ações críticas, Gregory é notificado
 * - Blocked: > 100% → para tudo, só responde com cache
 *
 * @see ADR-006: Token Economics
 */

import type { TokenBudget, TokenCost, IEventBus } from './interfaces.js';
import { Logger } from './logger.js';

// Preços por 1M tokens (Março 2026 — atualizar conforme Anthropic muda)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-3.5':         { input: 0.8, output: 4.0 },
  'claude-opus-4':            { input: 15.0, output: 75.0 },
};

export type BudgetTier = 'green' | 'yellow' | 'red' | 'blocked';

export interface BudgetConfig {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  yellowThreshold: number;  // 0.7
  redThreshold: number;     // 0.9
}

const DEFAULT_BUDGET: BudgetConfig = {
  dailyLimitUSD: 5.0,     // R$25/dia — conservative start
  monthlyLimitUSD: 100.0,  // R$500/mês — controlled burn
  yellowThreshold: 0.7,
  redThreshold: 0.9,
};

export class TokenBudgetManager {
  private config: BudgetConfig;
  private dailySpendUSD = 0;
  private monthlySpendUSD = 0;
  private lastDailyReset: Date;
  private lastMonthlyReset: Date;
  private usageLog: Array<{ timestamp: Date; cost: TokenCost; action: string }> = [];
  private readonly logger: Logger;
  private readonly eventBus?: IEventBus;

  constructor(
    config: Partial<BudgetConfig> = {},
    eventBus?: IEventBus,
  ) {
    this.config = { ...DEFAULT_BUDGET, ...config };
    this.lastDailyReset = this.startOfDay();
    this.lastMonthlyReset = this.startOfMonth();
    this.logger = new Logger({ component: 'TokenBudget' });
    this.eventBus = eventBus;
  }

  /**
   * Verifica se pode gastar ANTES de fazer a chamada.
   * Pre-flight check — evita gastar pra depois descobrir que passou.
   */
  canSpend(estimatedCostUSD: number): { allowed: boolean; tier: BudgetTier; reason?: string } {
    this.checkResets();
    const budget = this.getBudget();
    const projectedDaily = budget.currentDailyUSD + estimatedCostUSD;
    const projectedMonthly = budget.currentMonthlyUSD + estimatedCostUSD;

    if (projectedDaily > budget.dailyLimitUSD || projectedMonthly > budget.monthlyLimitUSD) {
      return {
        allowed: false,
        tier: 'blocked',
        reason: `Budget exceeded. Daily: $${projectedDaily.toFixed(4)}/$${budget.dailyLimitUSD}. Monthly: $${projectedMonthly.toFixed(4)}/$${budget.monthlyLimitUSD}`,
      };
    }

    const tier = this.calculateTier();
    return { allowed: true, tier };
  }

  /**
   * Registra gasto após a chamada.
   */
  recordSpend(cost: TokenCost, actionDescription: string): void {
    this.checkResets();

    this.dailySpendUSD += cost.estimatedCostUSD;
    this.monthlySpendUSD += cost.estimatedCostUSD;

    this.usageLog.push({
      timestamp: new Date(),
      cost,
      action: actionDescription,
    });

    const tier = this.calculateTier();

    if (tier === 'yellow') {
      this.logger.warn('Budget entering yellow zone', {
        dailySpend: this.dailySpendUSD,
        monthlySpend: this.monthlySpendUSD,
        tier,
      });
      this.eventBus?.emit({ type: 'budget.warning', payload: this.getBudget() });
    }

    if (tier === 'red' || tier === 'blocked') {
      this.logger.error('Budget critical', undefined, {
        dailySpend: this.dailySpendUSD,
        monthlySpend: this.monthlySpendUSD,
        tier,
      });
      this.eventBus?.emit({ type: 'budget.exceeded', payload: this.getBudget() });
    }
  }

  /**
   * Estima custo de uma chamada ANTES de fazer.
   */
  estimateCost(
    inputTokens: number,
    estimatedOutputTokens: number,
    model: string,
  ): number {
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-20250514'];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Sugere modelo baseado no tier atual.
   * Green → usa o modelo pedido
   * Yellow → downgrade pra Haiku se possível
   * Red → só Haiku
   */
  suggestModel(preferredModel: string): string {
    const tier = this.calculateTier();
    if (tier === 'green') return preferredModel;
    if (tier === 'yellow' && preferredModel.includes('opus')) return 'claude-sonnet-4-20250514';
    if (tier === 'red' || tier === 'blocked') return 'claude-haiku-3.5';
    return preferredModel;
  }

  getBudget(): TokenBudget {
    this.checkResets();
    return {
      dailyLimitUSD: this.config.dailyLimitUSD,
      monthlyLimitUSD: this.config.monthlyLimitUSD,
      currentDailyUSD: this.dailySpendUSD,
      currentMonthlyUSD: this.monthlySpendUSD,
      remainingDailyUSD: Math.max(0, this.config.dailyLimitUSD - this.dailySpendUSD),
      remainingMonthlyUSD: Math.max(0, this.config.monthlyLimitUSD - this.monthlySpendUSD),
      lastResetDaily: this.lastDailyReset,
      lastResetMonthly: this.lastMonthlyReset,
    };
  }

  getTier(): BudgetTier {
    return this.calculateTier();
  }

  getUsageLog(limit = 50) {
    return this.usageLog.slice(-limit);
  }

  /** Update limits em runtime */
  updateLimits(limits: Partial<Pick<BudgetConfig, 'dailyLimitUSD' | 'monthlyLimitUSD'>>): void {
    if (limits.dailyLimitUSD !== undefined) this.config.dailyLimitUSD = limits.dailyLimitUSD;
    if (limits.monthlyLimitUSD !== undefined) this.config.monthlyLimitUSD = limits.monthlyLimitUSD;
  }

  private calculateTier(): BudgetTier {
    const dailyRatio = this.dailySpendUSD / this.config.dailyLimitUSD;
    const monthlyRatio = this.monthlySpendUSD / this.config.monthlyLimitUSD;
    const maxRatio = Math.max(dailyRatio, monthlyRatio);

    if (maxRatio >= 1) return 'blocked';
    if (maxRatio >= this.config.redThreshold) return 'red';
    if (maxRatio >= this.config.yellowThreshold) return 'yellow';
    return 'green';
  }

  private checkResets(): void {
    const now = new Date();
    const todayStart = this.startOfDay();
    const monthStart = this.startOfMonth();

    if (todayStart.getTime() > this.lastDailyReset.getTime()) {
      this.dailySpendUSD = 0;
      this.lastDailyReset = todayStart;
      this.logger.info('Daily budget reset');
    }

    if (monthStart.getTime() > this.lastMonthlyReset.getTime()) {
      this.monthlySpendUSD = 0;
      this.lastMonthlyReset = monthStart;
      this.logger.info('Monthly budget reset');
    }
  }

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
