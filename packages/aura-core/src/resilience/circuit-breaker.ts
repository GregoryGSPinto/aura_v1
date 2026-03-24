/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  CIRCUIT BREAKER                                         ║
 * ║  Prevents cascade failures. If Brain or Body fails       ║
 * ║  repeatedly, stop hammering and degrade gracefully.      ║
 * ║  Pattern: Closed → Open → Half-Open → Closed             ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type { CircuitState, CircuitBreakerConfig, HealthStatus } from '../types/index.js';

interface FailureRecord {
  timestamp: Date;
  error: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private lastStateChange: Date = new Date();
  private halfOpenAttempts = 0;
  private successCount = 0;
  private totalCalls = 0;

  private readonly config: CircuitBreakerConfig;
  private readonly name: string;
  private onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;

  constructor(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
    onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void,
  ) {
    this.name = name;
    this.onStateChange = onStateChange;
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      resetTimeoutMs: config?.resetTimeoutMs ?? 30_000,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 3,
      monitorWindowMs: config?.monitorWindowMs ?? 60_000,
    };
  }

  /**
   * Execute a function through the circuit breaker.
   * If circuit is OPEN, fails fast without calling fn.
   * If circuit is HALF-OPEN, allows limited attempts.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitOpenError(
          `Circuit "${this.name}" is OPEN. Next retry in ${this.msUntilReset()}ms.`,
          this.name,
          this.msUntilReset(),
        );
      }
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
      this.transitionTo('open');
      throw new CircuitOpenError(
        `Circuit "${this.name}" half-open attempts exhausted. Reopening.`,
        this.name,
        this.config.resetTimeoutMs,
      );
    }

    try {
      if (this.state === 'half-open') this.halfOpenAttempts++;
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private onSuccess() {
    this.successCount++;
    if (this.state === 'half-open') {
      this.transitionTo('closed');
    }
    // Clean old failures outside monitoring window
    this.pruneOldFailures();
  }

  private onFailure(errorMessage: string) {
    this.failures.push({ timestamp: new Date(), error: errorMessage });
    this.pruneOldFailures();

    const recentFailures = this.failures.length;

    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state === 'closed' && recentFailures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState) {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    this.lastStateChange = new Date();

    if (newState === 'closed') {
      this.failures = [];
      this.halfOpenAttempts = 0;
    }
    if (newState === 'half-open') {
      this.halfOpenAttempts = 0;
    }

    this.onStateChange?.(this.name, oldState, newState);
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastStateChange.getTime() >= this.config.resetTimeoutMs;
  }

  private msUntilReset(): number {
    const elapsed = Date.now() - this.lastStateChange.getTime();
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  private pruneOldFailures() {
    const cutoff = Date.now() - this.config.monitorWindowMs;
    this.failures = this.failures.filter(f => f.getTime?.() ?? f.timestamp.getTime() > cutoff);
  }

  // ── Public Getters ──────────────────────────────────────

  getState(): CircuitState { return this.state; }
  getName(): string { return this.name; }

  getHealth(): HealthStatus {
    return {
      healthy: this.state === 'closed',
      component: `circuit:${this.name}`,
      latencyMs: 0,
      details: {
        state: this.state,
        recentFailures: this.failures.length,
        totalCalls: this.totalCalls,
        successRate: this.totalCalls > 0
          ? ((this.successCount / this.totalCalls) * 100).toFixed(1) + '%'
          : 'N/A',
      },
      checkedAt: new Date(),
    };
  }

  /**
   * Force reset — only for testing or manual recovery
   */
  reset() {
    this.transitionTo('closed');
    this.failures = [];
    this.halfOpenAttempts = 0;
  }
}

export class CircuitOpenError extends Error {
  readonly circuitName: string;
  readonly retryAfterMs: number;

  constructor(message: string, circuitName: string, retryAfterMs: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}
