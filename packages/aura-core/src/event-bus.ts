/**
 * AURA Event Bus
 *
 * Pub/Sub desacoplado. Cada componente emite eventos,
 * outros reagem sem dependência direta.
 *
 * Por que? Porque quando o CircuitBreaker abre, o Logger precisa saber,
 * o HealthCheck precisa saber, o Gregory precisa saber — mas nenhum
 * deles deveria depender diretamente do CircuitBreaker.
 */

import type { AuraEvent, IEventBus } from './interfaces.js';

type Handler = (payload: any) => void;

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<Handler>>();
  private history: Array<{ event: AuraEvent; timestamp: Date }> = [];
  private maxHistory: number;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 1000;
  }

  emit(event: AuraEvent): void {
    this.history.push({ event, timestamp: new Date() });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event.payload);
        } catch (err) {
          // Event handlers NEVER crash the bus
          console.error(`[EventBus] Handler error for ${event.type}:`, err);
        }
      }
    }
  }

  on<T extends AuraEvent['type']>(
    type: T,
    handler: (payload: Extract<AuraEvent, { type: T }>['payload']) => void,
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as Handler);

    // Retorna unsubscribe function
    return () => this.off(type, handler as Handler);
  }

  off(type: AuraEvent['type'], handler: Function): void {
    this.handlers.get(type)?.delete(handler as Handler);
  }

  getHistory(type?: AuraEvent['type'], limit = 50) {
    const filtered = type
      ? this.history.filter((h) => h.event.type === type)
      : this.history;
    return filtered.slice(-limit);
  }

  clear(): void {
    this.handlers.clear();
    this.history = [];
  }
}
