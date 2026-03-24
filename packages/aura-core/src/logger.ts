/**
 * AURA Structured Logger
 *
 * JSON structured logs com correlation IDs.
 * Cada request que entra na Aura ganha um correlationId.
 * Todo log emitido durante aquele request carrega o ID.
 * Resultado: grep pelo correlationId = timeline completa do request.
 *
 * Nível mínimo configurável. Em dev: debug. Em prod: info.
 * Fatal sempre dispara alerta.
 *
 * @see ADR-005: Error Handling & Resilience
 */

import type { LogLevel, RequestContext } from './interfaces.js';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  traceId?: string;
  component: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  durationMs?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LoggerConfig {
  minLevel: LogLevel;
  component: string;
  pretty: boolean;          // Human-readable in dev
  sink?: (entry: LogEntry) => void; // Custom sink (file, remote, etc)
}

export class Logger {
  private readonly config: LoggerConfig;
  private context?: RequestContext;

  constructor(config: Partial<LoggerConfig> & { component: string }) {
    this.config = {
      minLevel: config.minLevel ?? 'info',
      component: config.component,
      pretty: config.pretty ?? process.env.NODE_ENV !== 'production',
      sink: config.sink,
    };
  }

  /** Cria child logger com contexto do request */
  withContext(ctx: RequestContext): Logger {
    const child = new Logger(this.config);
    child.context = ctx;
    return child;
  }

  /** Cria child logger com componente diferente */
  child(component: string): Logger {
    return new Logger({ ...this.config, component });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('error', message, {
      ...data,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    });
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('fatal', message, {
      ...data,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    });
  }

  /** Timer helper — retorna função que loga a duração quando chamada */
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const durationMs = Date.now() - start;
      this.info(`${operation} completed`, { durationMs, operation });
    };
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.config.component,
      correlationId: this.context?.correlationId,
      traceId: this.context?.traceId,
    };

    // Extract error from data if present
    if (data?.error && typeof data.error === 'object') {
      entry.error = data.error as LogEntry['error'];
      const { error, ...rest } = data;
      if (Object.keys(rest).length > 0) entry.data = rest;
    } else if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    // Output
    if (this.config.sink) {
      this.config.sink(entry);
    } else if (this.config.pretty) {
      this.prettyPrint(entry);
    } else {
      // Structured JSON — prod-ready, parseable by any log aggregator
      const stream = level === 'error' || level === 'fatal' ? console.error : console.log;
      stream(JSON.stringify(entry));
    }
  }

  private prettyPrint(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m',  // gray
      info: '\x1b[36m',   // cyan
      warn: '\x1b[33m',   // yellow
      error: '\x1b[31m',  // red
      fatal: '\x1b[35m',  // magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level];

    const corr = entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : '';
    const prefix = `${color}[${entry.level.toUpperCase().padEnd(5)}]${reset}`;
    const comp = `\x1b[90m[${entry.component}]${reset}`;

    let line = `${prefix} ${comp}${corr} ${entry.message}`;

    if (entry.data) {
      line += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      line += `\n  ${color}${entry.error.name}: ${entry.error.message}${reset}`;
      if (entry.error.stack) {
        line += `\n  ${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}`;
      }
    }

    console.log(line);
  }
}
