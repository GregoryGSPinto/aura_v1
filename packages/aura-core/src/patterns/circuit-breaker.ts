/**
 * AURA Circuit Breaker
 *
 * Padrão: Closed → Open → Half-Open → Closed
 *
 * Se o Claude API falha 5x seguidas, para de chamar por 30s.
 * Depois testa com 1 request. Se funciona, volta ao normal.
 * Se não, abre de novo.
 *
 * Sem isso: uma falha no Claude API causa centenas de requests
 * falhando, queimando timeout e dinheiro.
 *
 * @see ADR-005: Error Handling & Resilience
 */

import type { CircuitBreakerState, IEventBus } from './interfaces.js';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;   // Quantas falhas pra abrir
  cooldownMs: number;         // Tempo aberto antes de testar
  halfOpenMaxAttempts: number; // Quantos testes em half-open
  onStateChange?: (state: CircuitBreakerState) => void;
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 1,
};

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;
  private nextRetryAt?: Date;
  private halfOpenAttempts = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly eventBus?: IEventBus;

  constructor(
    config: Partial<CircuitBreakerConfig> & { name: string },
    eventBus?: IEventBus,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;
  }

  /**
   * Executa função protegida pelo circuit breaker.
   * Se o circuito está aberto, rejeita imediatamente (fail fast).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half_open');
      } else {
        throw new CircuitOpenError(
          `Circuit "${this.config.name}" is OPEN. Next retry at ${this.nextRetryAt?.toISOString()}`,
          this.getState(),
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= this.config.halfOpenMaxAttempts) {
        this.transitionTo('closed');
      }
    }
    // Em closed, sucesso não muda nada (mas reseta failures)
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'half_open') {
      // Falha em half-open → volta pra open
      this.transitionTo('open');
      return;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: 'closed' | 'open' | 'half_open'): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'open') {
      this.nextRetryAt = new Date(Date.now() + this.config.cooldownMs);
      this.eventBus?.emit({ type: 'circuit.opened', payload: this.getState() });
    }

    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
      this.halfOpenAttempts = 0;
      this.nextRetryAt = undefined;
      this.eventBus?.emit({ type: 'circuit.closed', payload: this.getState() });
    }

    if (newState === 'half_open') {
      this.successes = 0;
      this.halfOpenAttempts = 0;
    }

    this.config.onStateChange?.(this.getState());
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextRetryAt) return false;
    return Date.now() >= this.nextRetryAt.getTime();
  }

  getState(): CircuitBreakerState {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      lastFailure: this.lastFailure,
      nextRetryAt: this.nextRetryAt,
      cooldownMs: this.config.cooldownMs,
    };
  }

  /** Force reset — apenas pra testes e emergências */
  reset(): void {
    this.transitionTo('closed');
  }
}

export class CircuitOpenError extends Error {
  readonly circuitState: CircuitBreakerState;

  constructor(message: string, state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitOpenError';
    this.circuitState = state;
  }
}
