/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  TOKEN BUDGET MANAGER                                    ║
 * ║  Every API call costs money. This ensures Aura never     ║
 * ║  burns Gregory's wallet. Daily + monthly caps.           ║
 * ║  Auto-downgrades model tier when budget runs low.        ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type { TokenBudget, CostEstimate, ModelTier } from '../types/index.js';

export interface BudgetConfig {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  warningThreshold: number; // 0-1, percentage of budget that triggers warning
  criticalThreshold: number; // 0-1, percentage that forces model downgrade
  emergencyReserveUSD: number; // always keep this much for critical actions
}

const DEFAULT_CONFIG: BudgetConfig = {
  dailyLimitUSD: 5.0,
  monthlyLimitUSD: 50.0,
  warningThreshold: 0.7,
  criticalThreshold: 0.9,
  emergencyReserveUSD: 0.50,
};

// Pricing per 1K tokens (as of 2026 — update as needed)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':   { input: 0.0008, output: 0.004 },
  'claude-sonnet-4-6':  { input: 0.003,  output: 0.015 },
  'claude-opus-4-6':    { input: 0.015,  output: 0.075 },
};

export type BudgetStatus = 'healthy' | 'warning' | 'critical' | 'exhausted';

export class TokenBudgetManager {
  private config: BudgetConfig;
  private budget: TokenBudget;
  private history: Array<{ timestamp: Date; cost: CostEstimate; model: string }> = [];
  private onBudgetAlert?: (status: BudgetStatus, budget: TokenBudget) => void;

  constructor(config?: Partial<BudgetConfig>, onAlert?: (status: BudgetStatus, budget: TokenBudget) => void) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onBudgetAlert = onAlert;
    this.budget = {
      dailyLimitUSD: this.config.dailyLimitUSD,
      monthlyLimitUSD: this.config.monthlyLimitUSD,
      currentDailyUSD: 0,
      currentMonthlyUSD: 0,
      lastResetDaily: new Date(),
      lastResetMonthly: new Date(),
    };
  }

  /**
   * Check if we can afford a call before making it.
   * Returns the recommended model tier based on remaining budget.
   */
  canAfford(estimatedCost: number): { allowed: boolean; recommendedTier: ModelTier; reason: string } {
    this.autoReset();

    const remainingDaily = this.config.dailyLimitUSD - this.budget.currentDailyUSD;
    const remainingMonthly = this.config.monthlyLimitUSD - this.budget.currentMonthlyUSD;
    const remaining = Math.min(remainingDaily, remainingMonthly);

    if (remaining <= this.config.emergencyReserveUSD) {
      return { allowed: false, recommendedTier: 'fast', reason: 'Budget exhausted. Emergency reserve only.' };
    }

    if (remaining < estimatedCost) {
      return { allowed: false, recommendedTier: 'fast', reason: `Insufficient budget. Need $${estimatedCost.toFixed(4)}, have $${remaining.toFixed(4)}` };
    }

    const usageRatio = 1 - (remaining / Math.min(this.config.dailyLimitUSD, this.config.monthlyLimitUSD));

    if (usageRatio >= this.config.criticalThreshold) {
      return { allowed: true, recommendedTier: 'fast', reason: 'Critical budget — downgraded to fastest model' };
    }

    if (usageRatio >= this.config.warningThreshold) {
      return { allowed: true, recommendedTier: 'balanced', reason: 'Budget warning — using balanced model' };
    }

    return { allowed: true, recommendedTier: 'deep', reason: 'Budget healthy — full model access' };
  }

  /**
   * Estimate cost before making a call
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): CostEstimate {
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-6'];
    const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;

    return {
      inputTokens,
      outputTokens,
      estimatedCostUSD: Math.round(cost * 10000) / 10000,
      model,
    };
  }

  /**
   * Record actual spend after a call completes
   */
  recordSpend(cost: CostEstimate) {
    this.autoReset();
    this.budget.currentDailyUSD += cost.estimatedCostUSD;
    this.budget.currentMonthlyUSD += cost.estimatedCostUSD;
    this.history.push({ timestamp: new Date(), cost, model: cost.model });

    // Check and emit alerts
    const status = this.getStatus();
    if (status !== 'healthy') {
      this.onBudgetAlert?.(status, { ...this.budget });
    }
  }

  getStatus(): BudgetStatus {
    this.autoReset();
    const dailyRatio = this.budget.currentDailyUSD / this.config.dailyLimitUSD;
    const monthlyRatio = this.budget.currentMonthlyUSD / this.config.monthlyLimitUSD;
    const ratio = Math.max(dailyRatio, monthlyRatio);

    if (ratio >= 1) return 'exhausted';
    if (ratio >= this.config.criticalThreshold) return 'critical';
    if (ratio >= this.config.warningThreshold) return 'warning';
    return 'healthy';
  }

  getBudget(): Readonly<TokenBudget> {
    this.autoReset();
    return { ...this.budget };
  }

  getSpendHistory(last?: number) {
    const h = [...this.history];
    return last ? h.slice(-last) : h;
  }

  getDailyBreakdown(): Record<string, number> {
    const today = new Date().toISOString().split('T')[0];
    const breakdown: Record<string, number> = {};
    for (const entry of this.history) {
      const day = entry.timestamp.toISOString().split('T')[0];
      if (day === today) {
        breakdown[entry.model] = (breakdown[entry.model] ?? 0) + entry.cost.estimatedCostUSD;
      }
    }
    return breakdown;
  }

  /**
   * Auto-reset daily/monthly counters when period rolls over
   */
  private autoReset() {
    const now = new Date();
    const lastDaily = this.budget.lastResetDaily;
    const lastMonthly = this.budget.lastResetMonthly;

    if (now.toDateString() !== lastDaily.toDateString()) {
      this.budget.currentDailyUSD = 0;
      this.budget.lastResetDaily = now;
    }

    if (now.getMonth() !== lastMonthly.getMonth() || now.getFullYear() !== lastMonthly.getFullYear()) {
      this.budget.currentMonthlyUSD = 0;
      this.budget.lastResetMonthly = now;
    }
  }
}
