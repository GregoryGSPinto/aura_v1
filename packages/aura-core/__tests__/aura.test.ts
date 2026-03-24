/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  AURA TEST SUITE                                         ║
 * ║  If it's not tested, it doesn't work.                    ║
 * ║  These tests are the CONTRACT between design and reality. ║
 * ║                                                          ║
 * ║  Run: npx tsx --test packages/aura-core/__tests__/       ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AutonomyGuard } from '../src/guards/autonomy-guard.js';
import { CircuitBreaker, CircuitOpenError } from '../src/resilience/circuit-breaker.js';
import { RetryEngine } from '../src/resilience/retry-engine.js';
import { TokenBudgetManager } from '../src/router/token-budget.js';
import { SmartModelRouter } from '../src/router/smart-model-router.js';
import { AuraLogger } from '../src/observability/logger.js';

// ═══════════════════════════════════════════════════════════════
// AUTONOMY GUARD TESTS
// The most critical tests in the entire system.
// If these fail, Aura can do things it should NEVER do.
// ═══════════════════════════════════════════════════════════════

describe('AutonomyGuard', () => {
  let guard: AutonomyGuard;

  beforeEach(() => {
    guard = new AutonomyGuard();
  });

  // ── L3 FORBIDDEN: ZERO TOLERANCE ───────────────────────

  describe('L3 — Forbidden Actions (HARDCODED)', () => {
    const L3_ACTIONS = [
      // Financial
      { type: 'payment', desc: 'Transfer $500 to vendor account', category: 'financial' },
      { type: 'purchase', desc: 'Buy premium subscription', category: 'financial' },
      { type: 'banking', desc: 'Send PIX to contractor', category: 'financial' },
      { type: 'billing', desc: 'Subscribe to monthly plan', category: 'financial' },
      { type: 'payment', desc: 'Pay invoice #4521', category: 'financial' },
      { type: 'crypto', desc: 'Invest in ETH position', category: 'financial' },

      // Legal
      { type: 'contract', desc: 'Sign the NDA agreement', category: 'legal' },
      { type: 'legal', desc: 'File a lawsuit against vendor', category: 'legal' },
      { type: 'ip', desc: 'Submit patent application', category: 'legal' },

      // Identity & Access
      { type: 'auth', desc: 'Change the API key for production', category: 'identity' },
      { type: 'account', desc: 'Delete account on platform', category: 'identity' },
      { type: 'security', desc: 'Reset password for admin', category: 'identity' },
      { type: 'auth', desc: 'Update 2FA settings', category: 'identity' },

      // Reputation
      { type: 'social', desc: 'Post public tweet about project', category: 'reputation' },
      { type: 'content', desc: 'Publish blog post to Medium', category: 'reputation' },
      { type: 'review', desc: 'Leave a public review on Google', category: 'reputation' },

      // Infrastructure
      { type: 'deploy', desc: 'Deploy to production server', category: 'infrastructure' },
      { type: 'database', desc: 'Drop table users in staging', category: 'infrastructure' },

      // Personal
      { type: 'health', desc: 'Request medical prescription refill', category: 'personal' },
    ];

    for (const action of L3_ACTIONS) {
      it(`BLOCKS "${action.desc}" (${action.category})`, () => {
        const result = guard.classify({
          id: `test-${Date.now()}`,
          type: action.type,
          description: action.desc,
        });

        assert.equal(result.level, 3, `Expected L3 for: "${action.desc}"`);
        assert.equal(result.confidence, 1.0, 'L3 confidence must always be 1.0');
      });
    }

    it('L3 count covers all critical categories', () => {
      const categories = AutonomyGuard.getL3Categories();
      assert.ok(categories.includes('financial'), 'Must cover financial');
      assert.ok(categories.includes('legal'), 'Must cover legal');
      assert.ok(categories.includes('identity'), 'Must cover identity');
      assert.ok(categories.includes('reputation'), 'Must cover reputation');
      assert.ok(categories.includes('infrastructure'), 'Must cover infrastructure');
      assert.ok(categories.includes('personal'), 'Must cover personal');
    });

    it('has minimum 10 L3 patterns', () => {
      assert.ok(
        AutonomyGuard.getL3PatternCount() >= 10,
        `Expected ≥10 L3 patterns, got ${AutonomyGuard.getL3PatternCount()}`,
      );
    });
  });

  // ── L3 IMMUTABILITY: THE MOST IMPORTANT TEST ──────────

  describe('L3 — Immutability Guarantee', () => {
    it('CANNOT promote financial action to L1', () => {
      const result = guard.promote('payment', 'Gregory wants to automate payments');
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('BLOCKED'));
      assert.ok(result.error?.includes('L3'));
    });

    it('CANNOT promote legal action to L1', () => {
      const result = guard.promote('sign contract', 'Gregory trusts Aura');
      assert.equal(result.success, false);
    });

    it('CANNOT promote credential action to L1', () => {
      const result = guard.promote('change password', 'Convenience');
      assert.equal(result.success, false);
    });

    it('CANNOT promote deploy action to L1', () => {
      const result = guard.promote('deploy prod release', 'Fast deploys');
      assert.equal(result.success, false);
    });

    it('L3 blocks even after 1000 promotion attempts', () => {
      for (let i = 0; i < 1000; i++) {
        guard.promote('transfer money', `attempt ${i}`);
      }
      const result = guard.classify({
        id: 'final-test',
        type: 'payment',
        description: 'Transfer money to account',
      });
      assert.equal(result.level, 3, 'L3 must hold after exhaustive promotion attempts');
    });
  });

  // ── L2 CLASSIFICATION ─────────────────────────────────

  describe('L2 — Approval Required', () => {
    const L2_ACTIONS = [
      { type: 'outreach', desc: 'Send email to potential client' },
      { type: 'job', desc: 'Apply to senior architect position' },
      { type: 'calendar', desc: 'Schedule meeting with team lead' },
      { type: 'sharing', desc: 'Share document with collaborator' },
    ];

    for (const action of L2_ACTIONS) {
      it(`requires approval for "${action.desc}"`, () => {
        const result = guard.classify({
          id: `test-${Date.now()}`,
          type: action.type,
          description: action.desc,
        });
        assert.equal(result.level, 2, `Expected L2 for: "${action.desc}"`);
      });
    }
  });

  // ── L1 AUTONOMOUS ─────────────────────────────────────

  describe('L1 — Autonomous Execution', () => {
    const L1_ACTIONS = [
      { type: 'research', desc: 'Search for AI architecture patterns' },
      { type: 'organize', desc: 'Sort bookmarks by category' },
      { type: 'analyze', desc: 'Review code quality metrics' },
      { type: 'summarize', desc: 'Create summary of meeting notes' },
    ];

    for (const action of L1_ACTIONS) {
      it(`auto-executes "${action.desc}"`, () => {
        const result = guard.classify({
          id: `test-${Date.now()}`,
          type: action.type,
          description: action.desc,
        });
        assert.equal(result.level, 1, `Expected L1 for: "${action.desc}"`);
      });
    }
  });

  // ── PROMOTION SYSTEM ──────────────────────────────────

  describe('Promotion System', () => {
    it('can promote L2 action to L1', () => {
      const promo = guard.promote('outreach', 'Gregory approves auto follow-ups');
      assert.equal(promo.success, true);

      const result = guard.classify({
        id: 'test-promoted',
        type: 'outreach',
        description: 'Send follow-up email to client',
      });
      assert.equal(result.level, 1);
      assert.equal(result.wasPromoted, true);
    });

    it('can demote promoted action back to L2', () => {
      guard.promote('outreach', 'test');
      const demoted = guard.demote('outreach');
      assert.equal(demoted, true);

      const result = guard.classify({
        id: 'test-demoted',
        type: 'outreach',
        description: 'Send email to new lead',
      });
      assert.equal(result.level, 2, 'Should be back to L2 after demotion');
    });

    it('tracks promotion history', () => {
      guard.promote('outreach', 'auto follow-ups');
      guard.promote('calendar', 'team syncs only');
      const promos = guard.getPromotions();
      assert.equal(promos.length, 2);
    });
  });

  // ── AUDIT LOG ─────────────────────────────────────────

  describe('Audit Trail', () => {
    it('records every classification', () => {
      guard.classify({ id: '1', type: 'research', description: 'look up data' });
      guard.classify({ id: '2', type: 'payment', description: 'send money' });
      guard.classify({ id: '3', type: 'outreach', description: 'email client' });

      const log = guard.getAuditLog();
      assert.equal(log.length, 3);
      assert.equal(log[0].outcome, 'allowed');
      assert.equal(log[1].outcome, 'blocked');
      assert.equal(log[2].outcome, 'queued');
    });

    it('provides accurate stats', () => {
      guard.classify({ id: '1', type: 'research', description: 'analyze data' });
      guard.classify({ id: '2', type: 'payment', description: 'buy something' });
      guard.classify({ id: '3', type: 'research', description: 'look up info' });

      const stats = guard.getStats();
      assert.equal(stats.total, 3);
      assert.equal(stats.L1, 2);
      assert.equal(stats.L3, 1);
    });

    it('fires audit callback', () => {
      const entries: unknown[] = [];
      const guardWithCallback = new AutonomyGuard({
        onAudit: (entry) => entries.push(entry),
      });
      guardWithCallback.classify({ id: '1', type: 'test', description: 'hello' });
      assert.equal(entries.length, 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER TESTS
// ═══════════════════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker('test');
    assert.equal(cb.getState(), 'closed');
  });

  it('stays closed on success', async () => {
    const cb = new CircuitBreaker('test');
    await cb.execute(() => Promise.resolve('ok'));
    assert.equal(cb.getState(), 'closed');
  });

  it('opens after failure threshold', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 3, monitorWindowMs: 60000 });

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
    }

    assert.equal(cb.getState(), 'open');
  });

  it('rejects fast when open', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 999999, monitorWindowMs: 60000 });
    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}

    assert.equal(cb.getState(), 'open');

    try {
      await cb.execute(() => Promise.resolve('should not run'));
      assert.fail('Should have thrown CircuitOpenError');
    } catch (error) {
      assert.ok(error instanceof CircuitOpenError);
    }
  });

  it('reports health status', () => {
    const cb = new CircuitBreaker('brain');
    const health = cb.getHealth();
    assert.equal(health.healthy, true);
    assert.equal(health.component, 'circuit:brain');
  });

  it('resets cleanly', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, monitorWindowMs: 60000 });
    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
    assert.equal(cb.getState(), 'open');

    cb.reset();
    assert.equal(cb.getState(), 'closed');

    const result = await cb.execute(() => Promise.resolve('recovered'));
    assert.equal(result, 'recovered');
  });
});

// ═══════════════════════════════════════════════════════════════
// RETRY ENGINE TESTS
// ═══════════════════════════════════════════════════════════════

describe('RetryEngine', () => {
  it('returns immediately on success', async () => {
    const engine = new RetryEngine();
    const action = { id: '1', type: 'test', description: 'test', autonomyLevel: 1 as const, status: 'executing' as const, retryCount: 0, maxRetries: 3, createdAt: new Date() };

    const result = await engine.executeWithRetry(
      () => Promise.resolve('success'),
      { action },
    );
    assert.equal(result, 'success');
  });

  it('sends to dead letter queue after max retries', async () => {
    const deadLetters: unknown[] = [];
    const engine = new RetryEngine(
      { maxRetries: 2, baseDelayMs: 10 },
      (entry) => deadLetters.push(entry),
    );

    const action = { id: 'dl-1', type: 'test', description: 'doomed', autonomyLevel: 1 as const, status: 'executing' as const, retryCount: 0, maxRetries: 2, createdAt: new Date() };

    try {
      await engine.executeWithRetry(
        () => Promise.reject(new Error('TIMEOUT: service down')),
        { action },
      );
    } catch {}

    assert.equal(deadLetters.length, 1);
    assert.equal(engine.getDeadLetterQueue().length, 1);
  });

  it('does not retry non-retriable errors', async () => {
    let attempts = 0;
    const engine = new RetryEngine({ maxRetries: 5, baseDelayMs: 10 });
    const action = { id: '1', type: 'test', description: 'test', autonomyLevel: 1 as const, status: 'executing' as const, retryCount: 0, maxRetries: 5, createdAt: new Date() };

    try {
      await engine.executeWithRetry(
        () => { attempts++; return Promise.reject(new Error('PERMISSION_DENIED')); },
        { action },
      );
    } catch {}

    assert.equal(attempts, 1, 'Non-retriable errors should not trigger retry');
  });
});

// ═══════════════════════════════════════════════════════════════
// TOKEN BUDGET MANAGER TESTS
// ═══════════════════════════════════════════════════════════════

describe('TokenBudgetManager', () => {
  it('starts with healthy budget', () => {
    const mgr = new TokenBudgetManager();
    assert.equal(mgr.getStatus(), 'healthy');
  });

  it('estimates cost correctly', () => {
    const mgr = new TokenBudgetManager();
    const cost = mgr.estimateCost('claude-sonnet-4-6', 1000, 500);
    assert.ok(cost.estimatedCostUSD > 0);
    assert.equal(cost.model, 'claude-sonnet-4-6');
  });

  it('tracks spend and transitions to warning', () => {
    const mgr = new TokenBudgetManager({ dailyLimitUSD: 1.0, warningThreshold: 0.5 });

    mgr.recordSpend({ inputTokens: 100000, outputTokens: 50000, estimatedCostUSD: 0.6, model: 'claude-sonnet-4-6' });
    assert.equal(mgr.getStatus(), 'warning');
  });

  it('blocks when exhausted', () => {
    const mgr = new TokenBudgetManager({ dailyLimitUSD: 1.0, emergencyReserveUSD: 0.1 });

    mgr.recordSpend({ inputTokens: 200000, outputTokens: 100000, estimatedCostUSD: 0.95, model: 'claude-opus-4-6' });

    const check = mgr.canAfford(0.1);
    assert.equal(check.allowed, false);
  });

  it('recommends cheaper model under pressure', () => {
    const mgr = new TokenBudgetManager({ dailyLimitUSD: 1.0, criticalThreshold: 0.8 });

    mgr.recordSpend({ inputTokens: 100000, outputTokens: 50000, estimatedCostUSD: 0.85, model: 'claude-opus-4-6' });

    const check = mgr.canAfford(0.05);
    assert.equal(check.recommendedTier, 'fast');
  });

  it('fires alert on budget transition', () => {
    const alerts: string[] = [];
    const mgr = new TokenBudgetManager(
      { dailyLimitUSD: 1.0, warningThreshold: 0.5 },
      (status) => alerts.push(status),
    );

    mgr.recordSpend({ inputTokens: 100000, outputTokens: 50000, estimatedCostUSD: 0.6, model: 'test' });
    assert.ok(alerts.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// SMART MODEL ROUTER TESTS
// ═══════════════════════════════════════════════════════════════

describe('SmartModelRouter', () => {
  let router: SmartModelRouter;

  beforeEach(() => {
    const budget = new TokenBudgetManager({ dailyLimitUSD: 10.0, monthlyLimitUSD: 100.0 });
    router = new SmartModelRouter(budget);
  });

  it('routes simple queries to fast tier', () => {
    const decision = router.route('What is the weather today?');
    assert.equal(decision.selectedModel.tier, 'fast');
  });

  it('routes complex reasoning to deep tier', () => {
    const decision = router.route(
      'Analyze the trade-offs between microservices and monolith architecture, compare their deployment strategies, and design a migration plan',
    );
    assert.equal(decision.selectedModel.tier, 'deep');
  });

  it('routes code tasks to balanced or deep tier', () => {
    const decision = router.route(
      'Debug this function and refactor the error handling to implement the circuit breaker pattern',
    );
    assert.ok(
      decision.selectedModel.tier === 'balanced' || decision.selectedModel.tier === 'deep',
      `Expected balanced or deep, got ${decision.selectedModel.tier}`,
    );
  });

  it('downgrades when budget is critical', () => {
    const tightBudget = new TokenBudgetManager({ dailyLimitUSD: 0.01, monthlyLimitUSD: 0.1 });
    tightBudget.recordSpend({ inputTokens: 1000, outputTokens: 500, estimatedCostUSD: 0.009, model: 'test' });
    const tightRouter = new SmartModelRouter(tightBudget);

    const decision = tightRouter.route('Design a complex distributed system architecture');
    assert.equal(decision.selectedModel.tier, 'fast', 'Should downgrade to fast when budget critical');
  });

  it('provides routing explanation', () => {
    const decision = router.route('Analyze market strategy');
    assert.ok(decision.reason.length > 0, 'Should provide routing reason');
    assert.ok(decision.complexityScore >= 0 && decision.complexityScore <= 1);
  });

  it('tracks routing statistics', () => {
    router.route('simple question');
    router.route('analyze complex strategy with trade-offs');
    router.route('debug code and refactor algorithm');

    const stats = router.getRoutingStats();
    assert.equal(stats.totalDecisions, 3);
    assert.ok(stats.totalEstimatedCostUSD >= 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// LOGGER TESTS
// ═══════════════════════════════════════════════════════════════

describe('AuraLogger', () => {
  it('buffers log entries', () => {
    const logger = new AuraLogger({ enableConsole: false });
    logger.info('test', 'hello world');
    logger.error('test', 'something broke');

    const buffer = logger.getBuffer();
    assert.equal(buffer.length, 2);
    assert.equal(buffer[0].level, 'info');
    assert.equal(buffer[1].level, 'error');
  });

  it('filters by log level', () => {
    const logger = new AuraLogger({ enableConsole: false, minLevel: 'warn' });
    logger.debug('test', 'should be ignored');
    logger.info('test', 'should be ignored');
    logger.warn('test', 'should appear');
    logger.error('test', 'should appear');

    assert.equal(logger.getBuffer().length, 2);
  });

  it('records metrics', () => {
    const logger = new AuraLogger({ enableConsole: false });
    logger.recordMetric('brain.latency', 1200, 'ms', { model: 'sonnet' });
    logger.recordMetric('brain.latency', 800, 'ms', { model: 'haiku' });

    const metrics = logger.getMetrics('brain.latency');
    assert.equal(metrics.length, 2);
  });

  it('times async operations', async () => {
    const logger = new AuraLogger({ enableConsole: false });
    const result = await logger.timed('test.op', 'test', async () => {
      await new Promise(r => setTimeout(r, 50));
      return 42;
    });

    assert.equal(result, 42);
    const metrics = logger.getMetrics('test.op.latency');
    assert.equal(metrics.length, 1);
    assert.ok(metrics[0].value >= 40, 'Should measure at least 40ms');
  });

  it('provides metrics summary', () => {
    const logger = new AuraLogger({ enableConsole: false });
    logger.recordMetric('latency', 100, 'ms');
    logger.recordMetric('latency', 200, 'ms');
    logger.recordMetric('latency', 300, 'ms');

    const summary = logger.getMetricsSummary();
    assert.equal(summary['latency'].count, 3);
    assert.equal(summary['latency'].avg, 200);
    assert.equal(summary['latency'].min, 100);
    assert.equal(summary['latency'].max, 300);
  });

  it('propagates trace context', () => {
    const logger = new AuraLogger({ enableConsole: false });
    const traceId = logger.startTrace();
    logger.info('test', 'traced message');

    const buffer = logger.getBuffer();
    assert.equal(buffer[0].traceId, traceId);

    logger.endTrace();
    logger.info('test', 'untraced message');
    const buffer2 = logger.getBuffer();
    assert.equal(buffer2[1].traceId, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════
// INTEGRATION: Full Pipeline Test
// ═══════════════════════════════════════════════════════════════

describe('Integration: Action Pipeline', () => {
  it('classifies → routes → budgets → logs a complete action', () => {
    const logger = new AuraLogger({ enableConsole: false });
    const guard = new AutonomyGuard({
      onAudit: (entry) => logger.info('guard', `${entry.outcome}: ${entry.actionDescription}`),
    });
    const budget = new TokenBudgetManager({ dailyLimitUSD: 5 });
    const router = new SmartModelRouter(budget);

    // Simulate an action flowing through the pipeline
    const traceId = logger.startTrace();

    // Step 1: Classify
    const classification = guard.classify({
      id: 'pipeline-1',
      type: 'research',
      description: 'Search for AI architect job postings in Brazil',
    });
    assert.equal(classification.level, 1, 'Research should be L1');

    // Step 2: Route to optimal model
    const routing = router.route('Search for AI architect job postings in Brazil');
    logger.info('router', `Selected ${routing.selectedModel.model}`, {
      tier: routing.selectedModel.tier,
      complexity: routing.complexityScore,
    });

    // Step 3: Check budget
    const budgetCheck = budget.canAfford(routing.estimatedCost.estimatedCostUSD);
    assert.equal(budgetCheck.allowed, true);

    // Step 4: Record spend
    budget.recordSpend(routing.estimatedCost);
    logger.recordMetric('action.cost', routing.estimatedCost.estimatedCostUSD, 'usd');

    logger.endTrace();

    // Verify full trace exists
    const logs = logger.getBuffer();
    assert.ok(logs.length >= 2, 'Pipeline should generate multiple log entries');
    assert.ok(logs.every(l => l.traceId === traceId), 'All logs should share trace ID');
  });

  it('blocks forbidden action through full pipeline', () => {
    const blocked: string[] = [];
    const guard = new AutonomyGuard({
      onAudit: (entry) => {
        if (entry.outcome === 'blocked') blocked.push(entry.actionDescription);
      },
    });

    const classification = guard.classify({
      id: 'forbidden-1',
      type: 'payment',
      description: 'Transfer R$10.000 via PIX to supplier',
    });

    assert.equal(classification.level, 3);
    assert.equal(classification.confidence, 1.0);
    assert.equal(blocked.length, 1);
    assert.ok(blocked[0].includes('PIX'));
  });
});
