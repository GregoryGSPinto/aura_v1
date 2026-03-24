/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  AURA LOGGER                                             ║
 * ║  Structured logging with trace context propagation.      ║
 * ║  Every action, every decision, every failure — traced.   ║
 * ║  JSON output ready for any log aggregator.               ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type { LogLevel, LogEntry, Metric } from '../types/index.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableBuffer: boolean;
  bufferMaxSize: number;
  enableMetrics: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  enableConsole: true,
  enableBuffer: true,
  bufferMaxSize: 10_000,
  enableMetrics: true,
};

export class AuraLogger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private metrics: Metric[] = [];
  private activeTraceId: string | null = null;
  private activeSpanId: string | null = null;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Core Logging ──────────────────────────────────────

  debug(component: string, message: string, data?: Record<string, unknown>) {
    this.log('debug', component, message, data);
  }

  info(component: string, message: string, data?: Record<string, unknown>) {
    this.log('info', component, message, data);
  }

  warn(component: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', component, message, data);
  }

  error(component: string, message: string, data?: Record<string, unknown>) {
    this.log('error', component, message, data);
  }

  fatal(component: string, message: string, data?: Record<string, unknown>) {
    this.log('fatal', component, message, data);
  }

  private log(level: LogLevel, component: string, message: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      data,
      traceId: this.activeTraceId ?? undefined,
      spanId: this.activeSpanId ?? undefined,
    };

    if (this.config.enableBuffer) {
      this.buffer.push(entry);
      if (this.buffer.length > this.config.bufferMaxSize) {
        this.buffer = this.buffer.slice(-this.config.bufferMaxSize);
      }
    }

    if (this.config.enableConsole) {
      const color = level === 'error' || level === 'fatal' ? '\x1b[31m'
        : level === 'warn' ? '\x1b[33m'
        : level === 'debug' ? '\x1b[90m'
        : '\x1b[36m';
      const reset = '\x1b[0m';
      const trace = entry.traceId ? ` [${entry.traceId.slice(0, 8)}]` : '';
      console.log(`${color}[${level.toUpperCase()}]${reset} ${component}${trace}: ${message}`);
      if (data) console.log(`  └─`, JSON.stringify(data, null, 2).split('\n').join('\n  '));
    }
  }

  // ── Trace Context ─────────────────────────────────────

  startTrace(traceId?: string): string {
    this.activeTraceId = traceId ?? crypto.randomUUID();
    this.activeSpanId = crypto.randomUUID();
    return this.activeTraceId;
  }

  startSpan(): string {
    this.activeSpanId = crypto.randomUUID();
    return this.activeSpanId;
  }

  endTrace() {
    this.activeTraceId = null;
    this.activeSpanId = null;
  }

  // ── Metrics ───────────────────────────────────────────

  recordMetric(name: string, value: number, unit: Metric['unit'], tags?: Record<string, string>) {
    if (!this.config.enableMetrics) return;

    const metric: Metric = {
      name,
      value,
      unit,
      tags: tags ?? {},
      timestamp: new Date(),
    };
    this.metrics.push(metric);
  }

  /**
   * Convenience: time an async operation and record latency
   */
  async timed<T>(name: string, component: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.recordMetric(`${name}.latency`, duration, 'ms', { component });
      this.recordMetric(`${name}.success`, 1, 'count', { component });
      this.info(component, `${name} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.recordMetric(`${name}.latency`, duration, 'ms', { component, status: 'error' });
      this.recordMetric(`${name}.failure`, 1, 'count', { component });
      this.error(component, `${name} failed after ${duration}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ── Querying ──────────────────────────────────────────

  getBuffer(options?: { level?: LogLevel; component?: string; last?: number }): LogEntry[] {
    let entries = [...this.buffer];

    if (options?.level) {
      const minLevel = LOG_LEVELS[options.level];
      entries = entries.filter(e => LOG_LEVELS[e.level] >= minLevel);
    }
    if (options?.component) {
      entries = entries.filter(e => e.component === options.component);
    }
    if (options?.last) {
      entries = entries.slice(-options.last);
    }

    return entries;
  }

  getMetrics(name?: string, since?: Date): Metric[] {
    let m = [...this.metrics];
    if (name) m = m.filter(metric => metric.name === name);
    if (since) m = m.filter(metric => metric.timestamp >= since);
    return m;
  }

  getMetricsSummary(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const summary: Record<string, { count: number; sum: number; min: number; max: number }> = {};

    for (const m of this.metrics) {
      if (!summary[m.name]) {
        summary[m.name] = { count: 0, sum: 0, min: Infinity, max: -Infinity };
      }
      summary[m.name].count++;
      summary[m.name].sum += m.value;
      summary[m.name].min = Math.min(summary[m.name].min, m.value);
      summary[m.name].max = Math.max(summary[m.name].max, m.value);
    }

    const result: Record<string, { count: number; avg: number; min: number; max: number }> = {};
    for (const [name, s] of Object.entries(summary)) {
      result[name] = { count: s.count, avg: s.sum / s.count, min: s.min, max: s.max };
    }
    return result;
  }

  clear() {
    this.buffer = [];
    this.metrics = [];
  }
}
