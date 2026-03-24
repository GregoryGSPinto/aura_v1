/**
 * AURA CORE — Interface Contracts v2.0
 *
 * REGRA DE OURO: Mudar um contrato = migration em TODOS os plugins.
 * Cada campo foi pensado. Nada é acidental.
 *
 * @author Gregory — AI Solution Architect
 * @see ADR-001: Arquitetura Plugável em Três Camadas
 * @see ADR-002: Memory Engine Schema
 * @see ADR-003: Autonomy Guard
 */

// ============================================================
// TIPOS BASE
// ============================================================

export type AutonomyLevel = 1 | 2 | 3;

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
  | 'retrying'
  | 'dead_letter';

export type Channel = 'web' | 'mobile' | 'desktop' | 'tv' | 'voice' | 'glasses' | 'api';

export type KnowledgeCategory =
  | 'preference'
  | 'fact'
  | 'project'
  | 'contact'
  | 'goal'
  | 'skill'
  | 'routine'
  | 'boundary';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// ============================================================
// CORRELATION & TRACING
// ============================================================

export interface RequestContext {
  correlationId: string;
  traceId: string;
  spanId: string;
  channel: Channel;
  timestamp: Date;
  userId: 'gregory'; // Single-user system — hardcoded by design
}

// ============================================================
// MENSAGENS
// ============================================================

export interface Message {
  id: string;
  role: 'gregory' | 'aura' | 'system';
  content: string;
  timestamp: Date;
  channel: Channel;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// AÇÕES
// ============================================================

export interface Action {
  id: string;
  type: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  status: ActionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  error?: ActionError;
  createdAt: Date;
  executedAt?: Date;
  approvedAt?: Date;
  correlationId: string;
}

export interface ActionError {
  code: string;
  message: string;
  stack?: string;
  retryable: boolean;
  occurredAt: Date;
}

export interface ExecutedAction extends Action {
  status: 'completed' | 'failed' | 'dead_letter';
  executedAt: Date;
  durationMs: number;
  tokenCost: TokenCost;
}

// ============================================================
// TOKEN ECONOMICS
// ============================================================

export interface TokenCost {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  model: string;
  cached: boolean;
}

export interface TokenBudget {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  currentDailyUSD: number;
  currentMonthlyUSD: number;
  remainingDailyUSD: number;
  remainingMonthlyUSD: number;
  lastResetDaily: Date;
  lastResetMonthly: Date;
}

// ============================================================
// KNOWLEDGE / MEMORY
// ============================================================

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  key: string;
  value: string;
  confidence: number;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface AuraMemoryExport {
  version: string;
  exportedAt: string;
  checksum: string;
  conversations: unknown[];
  messages: unknown[];
  knowledge: unknown[];
  actions: unknown[];
  tokenUsage: unknown[];
}

// ============================================================
// BRAIN CONTRACT — O que qualquer LLM precisa implementar
// ============================================================

export interface IBrain {
  readonly providerId: string;
  readonly model: string;

  /** Conecta ao provider */
  connect(): Promise<void>;

  /** Envia mensagem e recebe resposta */
  think(
    messages: Message[],
    context: KnowledgeEntry[],
    budget: TokenBudget,
  ): Promise<BrainResponse>;

  /** Classifica ação por nível de autonomia */
  classify(action: Action): Promise<AutonomyLevel>;

  /** Summariza histórico pra caber no context window */
  summarize(messages: Message[], maxTokens: number): Promise<string>;

  /** Health check */
  ping(): Promise<{ ok: boolean; latencyMs: number }>;

  /** Desconecta */
  disconnect(): Promise<void>;
}

export interface BrainResponse {
  content: string;
  actions: Action[];
  tokenCost: TokenCost;
  latencyMs: number;
  model: string;
  finishReason: 'complete' | 'truncated' | 'error';
}

// ============================================================
// BODY CONTRACT — O que qualquer executor precisa implementar
// ============================================================

export interface IBody {
  readonly executorId: string;

  /** Conecta ao executor */
  connect(): Promise<void>;

  /** Executa uma ação aprovada */
  execute(action: Action, ctx: RequestContext): Promise<ExecutionResult>;

  /** Lista skills disponíveis */
  listSkills(): Promise<BodySkill[]>;

  /** Verifica se pode executar determinado tipo de ação */
  canExecute(actionType: string): Promise<boolean>;

  /** Health check */
  ping(): Promise<{ ok: boolean; latencyMs: number }>;

  /** Desconecta */
  disconnect(): Promise<void>;
}

export interface ExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: ActionError;
  durationMs: number;
  skillUsed: string;
}

export interface BodySkill {
  id: string;
  name: string;
  description: string;
  actionTypes: string[];
  whitelisted: boolean;
  lastAuditedAt?: Date;
}

// ============================================================
// AURA CORE CONTRACT — A consciência
// ============================================================

export interface IAura {
  /** Processa input do Gregory */
  process(input: string, channel: Channel): Promise<AuraResponse>;

  /** Aprova ação L2 pendente */
  approve(actionId: string): Promise<ExecutedAction>;

  /** Rejeita ação L2 pendente */
  reject(actionId: string, reason: string): Promise<Action>;

  /** Consulta memória */
  recall(category: KnowledgeCategory, query?: string): Promise<KnowledgeEntry[]>;

  /** Exporta toda a memória */
  exportMemory(): Promise<AuraMemoryExport>;

  /** Importa memória */
  importMemory(data: AuraMemoryExport): Promise<{ imported: number; skipped: number }>;

  /** Status completo do sistema */
  getHealth(): Promise<SystemHealth>;

  /** Token budget atual */
  getBudget(): Promise<TokenBudget>;
}

export interface AuraResponse {
  message: string;
  actions: Action[];
  channel: Channel;
  responseTimeMs: number;
  tokenCost: TokenCost;
  correlationId: string;
}

// ============================================================
// OBSERVABILITY
// ============================================================

export interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  brain: ComponentHealth;
  body: ComponentHealth;
  memory: MemoryHealth;
  budget: TokenBudget;
  circuitBreakers: Record<string, CircuitBreakerState>;
  timestamp: Date;
}

export interface ComponentHealth {
  status: HealthStatus;
  providerId: string;
  latencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  errorRate: number;
  consecutiveFailures: number;
}

export interface MemoryHealth {
  status: HealthStatus;
  totalConversations: number;
  totalKnowledge: number;
  totalActions: number;
  sizeBytes: number;
  oldestEntry: Date;
  newestEntry: Date;
}

export interface CircuitBreakerState {
  name: string;
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  threshold: number;
  lastFailure?: Date;
  nextRetryAt?: Date;
  cooldownMs: number;
}

// ============================================================
// EVENTS — Pub/Sub interno
// ============================================================

export type AuraEvent =
  | { type: 'action.proposed'; payload: Action }
  | { type: 'action.classified'; payload: Action & { level: AutonomyLevel } }
  | { type: 'action.approved'; payload: Action }
  | { type: 'action.rejected'; payload: Action & { reason: string } }
  | { type: 'action.executed'; payload: ExecutedAction }
  | { type: 'action.failed'; payload: Action & { error: ActionError } }
  | { type: 'action.blocked'; payload: Action }
  | { type: 'action.dead_letter'; payload: Action }
  | { type: 'budget.warning'; payload: TokenBudget }
  | { type: 'budget.exceeded'; payload: TokenBudget }
  | { type: 'circuit.opened'; payload: CircuitBreakerState }
  | { type: 'circuit.closed'; payload: CircuitBreakerState }
  | { type: 'health.degraded'; payload: SystemHealth }
  | { type: 'health.recovered'; payload: SystemHealth }
  | { type: 'memory.exported'; payload: { checksum: string; sizeBytes: number } }
  | { type: 'memory.imported'; payload: { imported: number; skipped: number } };

export interface IEventBus {
  emit(event: AuraEvent): void;
  on<T extends AuraEvent['type']>(
    type: T,
    handler: (payload: Extract<AuraEvent, { type: T }>['payload']) => void,
  ): () => void;
  off(type: AuraEvent['type'], handler: Function): void;
}
