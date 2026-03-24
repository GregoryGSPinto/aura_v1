/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  RETRY ENGINE                                            ║
 * ║  Exponential backoff + jitter. Dead letter queue for      ║
 * ║  permanently failed actions. Gregory gets notified.       ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type { Action, ActionError } from '../types/index.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // 0-1, randomness to prevent thundering herd
  retriableErrors: string[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitterFactor: 0.3,
  retriableErrors: [
    'TIMEOUT',
    'RATE_LIMIT',
    'SERVICE_UNAVAILABLE',
    'NETWORK_ERROR',
    'BRAIN_OVERLOADED',
    'BODY_UNAVAILABLE',
  ],
};

export interface DeadLetterEntry {
  action: Action;
  finalError: ActionError;
  attempts: number;
  firstAttemptAt: Date;
  deadAt: Date;
}

export class RetryEngine {
  private config: RetryConfig;
  private deadLetterQueue: DeadLetterEntry[] = [];
  private onDeadLetter?: (entry: DeadLetterEntry) => void;

  constructor(config?: Partial<RetryConfig>, onDeadLetter?: (entry: DeadLetterEntry) => void) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onDeadLetter = onDeadLetter;
  }

  /**
   * Execute with automatic retry.
   * Returns the successful result or throws after all retries exhausted.
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: { action: Action },
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetriable(lastError) || attempt === this.config.maxRetries) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    // All retries exhausted — send to dead letter queue
    const deadEntry: DeadLetterEntry = {
      action: context.action,
      finalError: {
        code: 'RETRIES_EXHAUSTED',
        message: lastError?.message ?? 'Unknown error',
        stack: lastError?.stack,
        retriable: false,
        occurredAt: new Date(),
      },
      attempts: this.config.maxRetries + 1,
      firstAttemptAt: context.action.createdAt,
      deadAt: new Date(),
    };

    this.deadLetterQueue.push(deadEntry);
    this.onDeadLetter?.(deadEntry);

    throw lastError;
  }

  private isRetriable(error: Error): boolean {
    return this.config.retriableErrors.some(code =>
      error.message.includes(code) || error.name.includes(code)
    );
  }

  /**
   * Exponential backoff with jitter:
   * delay = min(maxDelay, baseDelay * 2^attempt) * (1 ± jitter)
   */
  private calculateDelay(attempt: number): number {
    const exponential = Math.min(
      this.config.maxDelayMs,
      this.config.baseDelayMs * Math.pow(2, attempt),
    );
    const jitter = exponential * this.config.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(exponential + jitter));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Dead Letter Queue ─────────────────────────────────

  getDeadLetterQueue(): ReadonlyArray<DeadLetterEntry> {
    return [...this.deadLetterQueue];
  }

  replayDeadLetter(actionId: string): DeadLetterEntry | null {
    const index = this.deadLetterQueue.findIndex(e => e.action.id === actionId);
    if (index === -1) return null;
    return this.deadLetterQueue.splice(index, 1)[0];
  }

  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    return count;
  }

  getStats() {
    return {
      deadLetterCount: this.deadLetterQueue.length,
      config: { ...this.config },
    };
  }
}
