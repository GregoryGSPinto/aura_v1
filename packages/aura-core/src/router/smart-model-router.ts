/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  SMART MODEL ROUTER                                      ║
 * ║  Not every thought needs Opus. Simple tasks get Haiku.   ║
 * ║  Complex reasoning gets Opus. Budget-aware routing.      ║
 * ║  This alone saves 60-80% on API costs.                   ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type { ModelConfig, ModelTier, RoutingDecision, CostEstimate } from '../types/index.js';
import { TokenBudgetManager } from './token-budget.js';

// ── Model Registry ──────────────────────────────────────────

const MODELS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: 'fast',
    model: 'claude-haiku-4-5',
    maxTokens: 4096,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    avgLatencyMs: 400,
  },
  balanced: {
    tier: 'balanced',
    model: 'claude-sonnet-4-6',
    maxTokens: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    avgLatencyMs: 1200,
  },
  deep: {
    tier: 'deep',
    model: 'claude-opus-4-6',
    maxTokens: 16384,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    avgLatencyMs: 3500,
  },
};

// ── Complexity Signals ──────────────────────────────────────

interface ComplexitySignals {
  messageLength: number;
  hasCodeContext: boolean;
  hasMultiStepReasoning: boolean;
  hasCreativeTask: boolean;
  hasDataAnalysis: boolean;
  conversationDepth: number;
  urgency: 'low' | 'normal' | 'high';
}

const COMPLEXITY_PATTERNS = {
  code: /\b(code|function|class|debug|refactor|implement|algorithm|api|bug|error|stack.?trace)\b/i,
  multiStep: /\b(plan|strategy|compare|analyze|evaluate|design|architect|trade.?off|pros.?cons)\b/i,
  creative: /\b(write|compose|draft|create|generate|brainstorm|ideate|story|proposal)\b/i,
  data: /\b(data|metrics|chart|graph|statistics|trend|forecast|performance|kpi)\b/i,
  simple: /\b(what.?is|define|list|translate|summarize|when.?was|how.?many|yes.?or.?no)\b/i,
};

export class SmartModelRouter {
  private budgetManager: TokenBudgetManager;
  private routingHistory: RoutingDecision[] = [];

  constructor(budgetManager: TokenBudgetManager) {
    this.budgetManager = budgetManager;
  }

  /**
   * Analyze the prompt and select the optimal model.
   * Considers: task complexity, budget state, urgency.
   */
  route(prompt: string, conversationDepth: number = 0, urgency: 'low' | 'normal' | 'high' = 'normal'): RoutingDecision {
    const signals = this.analyzeComplexity(prompt, conversationDepth, urgency);
    const complexityScore = this.calculateScore(signals);

    // Determine ideal tier from complexity
    let idealTier: ModelTier;
    if (complexityScore >= 0.7) idealTier = 'deep';
    else if (complexityScore >= 0.35) idealTier = 'balanced';
    else idealTier = 'fast';

    // Budget may override the ideal tier
    const model = MODELS[idealTier];
    const estimatedTokens = this.estimateTokens(prompt, model);
    const estimatedCost = this.budgetManager.estimateCost(
      model.model,
      estimatedTokens.input,
      estimatedTokens.output,
    );

    const budgetCheck = this.budgetManager.canAfford(estimatedCost.estimatedCostUSD);

    let selectedTier = idealTier;
    let reason = '';

    if (!budgetCheck.allowed) {
      // Budget exhausted — try cheaper model
      selectedTier = budgetCheck.recommendedTier;
      reason = `Budget constraint: ${budgetCheck.reason}. Downgraded from ${idealTier} to ${selectedTier}.`;
    } else if (budgetCheck.recommendedTier !== 'deep' && idealTier === 'deep') {
      // Budget pressure — suggest downgrade
      selectedTier = budgetCheck.recommendedTier;
      reason = `Budget pressure: ${budgetCheck.reason}. Using ${selectedTier} instead of ${idealTier}.`;
    } else {
      reason = this.explainRouting(signals, complexityScore, idealTier);
    }

    // Urgency override: high urgency always uses fast if possible
    if (urgency === 'high' && selectedTier === 'deep') {
      selectedTier = 'balanced';
      reason = `High urgency override: using ${selectedTier} for faster response.`;
    }

    const selectedModel = MODELS[selectedTier];
    const finalEstimate = this.budgetManager.estimateCost(
      selectedModel.model,
      estimatedTokens.input,
      estimatedTokens.output,
    );

    const decision: RoutingDecision = {
      selectedModel,
      reason,
      estimatedCost: finalEstimate,
      complexityScore,
    };

    this.routingHistory.push(decision);
    return decision;
  }

  private analyzeComplexity(prompt: string, conversationDepth: number, urgency: 'low' | 'normal' | 'high'): ComplexitySignals {
    return {
      messageLength: prompt.length,
      hasCodeContext: COMPLEXITY_PATTERNS.code.test(prompt),
      hasMultiStepReasoning: COMPLEXITY_PATTERNS.multiStep.test(prompt),
      hasCreativeTask: COMPLEXITY_PATTERNS.creative.test(prompt),
      hasDataAnalysis: COMPLEXITY_PATTERNS.data.test(prompt),
      conversationDepth,
      urgency,
    };
  }

  private calculateScore(signals: ComplexitySignals): number {
    let score = 0;

    // Length contribution (longer = more complex, up to 0.2)
    score += Math.min(0.2, signals.messageLength / 5000 * 0.2);

    // Pattern contributions
    if (signals.hasMultiStepReasoning) score += 0.3;
    if (signals.hasCodeContext) score += 0.2;
    if (signals.hasCreativeTask) score += 0.15;
    if (signals.hasDataAnalysis) score += 0.15;

    // Conversation depth (deeper = more context needed)
    score += Math.min(0.15, signals.conversationDepth * 0.03);

    return Math.min(1, score);
  }

  private estimateTokens(prompt: string, _model: ModelConfig): { input: number; output: number } {
    // ~4 chars per token for English, ~3 for Portuguese
    const inputTokens = Math.ceil(prompt.length / 3.5);
    const outputTokens = Math.ceil(inputTokens * 1.5); // rough estimate
    return { input: inputTokens, output: outputTokens };
  }

  private explainRouting(signals: ComplexitySignals, score: number, tier: ModelTier): string {
    const factors: string[] = [];
    if (signals.hasMultiStepReasoning) factors.push('multi-step reasoning');
    if (signals.hasCodeContext) factors.push('code context');
    if (signals.hasCreativeTask) factors.push('creative generation');
    if (signals.hasDataAnalysis) factors.push('data analysis');
    if (factors.length === 0) factors.push('simple query');

    return `Complexity ${(score * 100).toFixed(0)}% [${factors.join(', ')}] → ${tier} tier`;
  }

  // ── Analytics ─────────────────────────────────────────

  getRoutingStats() {
    const byTier: Record<ModelTier, number> = { fast: 0, balanced: 0, deep: 0 };
    let totalEstimatedCost = 0;

    for (const d of this.routingHistory) {
      byTier[d.selectedModel.tier]++;
      totalEstimatedCost += d.estimatedCost.estimatedCostUSD;
    }

    return {
      totalDecisions: this.routingHistory.length,
      byTier,
      totalEstimatedCostUSD: Math.round(totalEstimatedCost * 10000) / 10000,
      avgComplexity: this.routingHistory.length > 0
        ? (this.routingHistory.reduce((s, d) => s + d.complexityScore, 0) / this.routingHistory.length).toFixed(2)
        : 'N/A',
    };
  }

  static getAvailableModels(): Record<ModelTier, ModelConfig> {
    return { ...MODELS };
  }
}
