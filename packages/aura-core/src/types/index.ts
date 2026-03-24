/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  AURA CORE — Type System                                 ║
 * ║  Every type here is a design decision.                   ║
 * ║  Change with ADR or don't change at all.                 ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

// ── Autonomy ────────────────────────────────────────────────

export const AUTONOMY_LEVELS = {
  L1_AUTONOMOUS: 1,
  L2_APPROVAL: 2,
  L3_FORBIDDEN: 3,
} as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[keyof typeof AUTONOMY_LEVELS];

export type ActionStatus =
  | 'proposed'
  | 'classified'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'timeout'
  | 'retrying';

// ── Channels ────────────────────────────────────────────────

export type Channel = 'web' | 'mobile' | 'desktop' | 'voice' | 'api' | 'cron';

// ── Knowledge ───────────────────────────────────────────────

export type KnowledgeCategory =
  | 'preference'
  | 'fact'
  | 'project'
  | 'contact'
  | 'goal'
  | 'skill'
  | 'routine'
  | 'insight';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  key: string;
  value: string;
  confidence: number;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  accessCount: number;
  lastAccessedAt: Date | null;
}

// ── Messages ────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'gregory' | 'aura' | 'system';
  content: string;
  timestamp: Date;
  channel: Channel;
  tokensUsed?: number;
  brainProvider?: string;
  latencyMs?: number;
}

// ── Actions ─────────────────────────────────────────────────

export interface Action {
  id: string;
  type: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  status: ActionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: ActionError;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  classifiedAt?: Date;
  approvedAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  costEstimate?: CostEstimate;
}

export interface ActionError {
  code: string;
  message: string;
  stack?: string;
  retriable: boolean;
  occurredAt: Date;
}

// ── Cost ────────────────────────────────────────────────────

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  model: string;
}

export interface TokenBudget {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  currentDailyUSD: number;
  currentMonthlyUSD: number;
  lastResetDaily: Date;
  lastResetMonthly: Date;
}

// ── Brain Contract ──────────────────────────────────────────

export interface IBrain {
  readonly providerId: string;
  readonly model: string;

  think(prompt: string, context: BrainContext): Promise<BrainResponse>;
  classify(action: Action): Promise<AutonomyLevel>;
  summarize(messages: Message[]): Promise<string>;
  healthCheck(): Promise<HealthStatus>;
}

export interface BrainContext {
  conversationHistory: Message[];
  relevantKnowledge: KnowledgeEntry[];
  pendingActions: Action[];
  tokenBudget: TokenBudget;
  channel: Channel;
}

export interface BrainResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  latencyMs: number;
  suggestedActions: Omit<Action, 'id' | 'status' | 'createdAt' | 'retryCount' | 'maxRetries'>[];
  confidence: number;
}

// ── Body Contract ───────────────────────────────────────────

export interface IBody {
  readonly executorId: string;

  execute(action: Action): Promise<ActionResult>;
  getCapabilities(): Promise<string[]>;
  healthCheck(): Promise<HealthStatus>;
}

export interface ActionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: ActionError;
  executionTimeMs: number;
}

// ── Observability ───────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface Metric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'usd' | 'tokens' | 'percent' | 'bytes';
  tags: Record<string, string>;
  timestamp: Date;
}

export interface HealthStatus {
  healthy: boolean;
  component: string;
  latencyMs: number;
  details?: Record<string, unknown>;
  checkedAt: Date;
}

// ── Circuit Breaker ─────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitorWindowMs: number;
}

// ── Model Router ────────────────────────────────────────────

export type ModelTier = 'fast' | 'balanced' | 'deep';

export interface ModelConfig {
  tier: ModelTier;
  model: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number;
}

export interface RoutingDecision {
  selectedModel: ModelConfig;
  reason: string;
  estimatedCost: CostEstimate;
  complexityScore: number;
}

// ── Memory Consolidation ────────────────────────────────────

export interface ConsolidationResult {
  conversationsProcessed: number;
  knowledgeExtracted: number;
  knowledgeUpdated: number;
  knowledgeExpired: number;
  tokensSaved: number;
  consolidatedAt: Date;
}

// ── Aura Status ─────────────────────────────────────────────

export interface AuraStatus {
  brain: HealthStatus;
  body: HealthStatus;
  memory: {
    totalConversations: number;
    totalKnowledge: number;
    totalActions: number;
    sizeBytes: number;
  };
  circuit: {
    brain: CircuitState;
    body: CircuitState;
  };
  budget: TokenBudget;
  uptime: number;
  version: string;
}
