/**
 * AURA Core — Public API
 *
 * Tudo que plugins precisam importar vem daqui.
 * Se não tá exportado aqui, é interno.
 */

// Contracts
export type {
  IAura, IBrain, IBody, IEventBus,
  Action, ActionError, ActionStatus, AuraEvent, AuraMemoryExport,
  AuraResponse, AutonomyLevel, BodySkill, BrainResponse, Channel,
  CircuitBreakerState, ComponentHealth, ExecutedAction, ExecutionResult,
  HealthStatus, KnowledgeCategory, KnowledgeEntry, LogLevel, MemoryHealth,
  Message, RequestContext, SystemHealth, TokenBudget, TokenCost,
} from './interfaces.js';

// Core
export { Aura } from './aura.js';
export type { AuraConfig } from './aura.js';

// Modules
export { AutonomyGuard, AutonomyViolationError } from './autonomy-guard.js';
export { MemoryEngine } from './memory-engine.js';
export type { DatabaseAdapter } from './memory-engine.js';
export { TokenBudgetManager } from './token-budget.js';
export type { BudgetTier } from './token-budget.js';
export { EventBus } from './event-bus.js';
export { Logger } from './logger.js';

// Patterns
export { CircuitBreaker, CircuitOpenError } from './patterns/circuit-breaker.js';
export { withRetry } from './patterns/retry.js';
