/**
 * AURA Retry Engine
 *
 * Exponential backoff com jitter. Sem jitter, todos os retries
 * acontecem no mesmo instante e DDOSam o provider.
 *
 * Retry NÃO é pra tudo:
 * - 429 (rate limit) → retry com backoff
 * - 500 (server error) → retry com backoff
 * - 401 (auth error) → NÃO retry, credencial tá errada
 * - 400 (bad request) → NÃO retry, payload tá errado
 *
 * @see ADR-005: Error Handling & Resilience
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Não retenta se o erro não é retryable
      if (!isRetryable(lastError, cfg.retryableErrors)) {
        throw lastError;
      }

      // Última tentativa — não espera, joga o erro
      if (attempt === cfg.maxRetries) break;

      const delay = calculateDelay(attempt, cfg);
      cfg.onRetry?.(attempt + 1, lastError, delay);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Retry exhausted');
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s...
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, config.maxDelayMs);

  if (!config.jitter) return capped;

  // Full jitter: random entre 0 e o delay calculado
  return Math.floor(Math.random() * capped);
}

function isRetryable(error: Error, customCodes?: string[]): boolean {
  const message = error.message.toLowerCase();

  // HTTP errors que são retryable
  if (message.includes('429') || message.includes('rate limit')) return true;
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
  if (message.includes('timeout') || message.includes('econnreset')) return true;
  if (message.includes('network') || message.includes('fetch failed')) return true;

  // HTTP errors que NÃO são retryable
  if (message.includes('401') || message.includes('403')) return false;
  if (message.includes('400') || message.includes('422')) return false;

  // Custom codes
  if (customCodes?.some((code) => message.includes(code.toLowerCase()))) return true;

  // Default: não retenta erros desconhecidos
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
