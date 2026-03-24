/**
 * AURA Memory Engine v2.0
 *
 * O ativo mais valioso de toda a Aura. Perde código? Reescreve.
 * Perde a memória? Perde contexto de meses. BACKUP DIÁRIO. SEMPRE.
 *
 * v2.0 upgrades:
 * - Access tracking (LRU pra context window optimization)
 * - Checksum em exports (integridade)
 * - Knowledge confidence decay (info velha perde confiança)
 * - Token-aware context retrieval (cabe no context window)
 *
 * @see ADR-002: Memory Engine Schema
 * @see ADR-004: Memory Sovereignty
 */

import { randomUUID, createHash } from 'crypto';
import type {
  KnowledgeEntry,
  KnowledgeCategory,
  Message,
  Action,
  AuraMemoryExport,
  MemoryHealth,
  IEventBus,
} from './interfaces.js';
import { Logger } from './logger.js';

// ============================================================
// DATABASE ADAPTER — agnóstico de implementação
// ============================================================

export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): Promise<void>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

// ============================================================
// MEMORY ENGINE
// ============================================================

export class MemoryEngine {
  private db: DatabaseAdapter;
  private readonly logger: Logger;
  private readonly eventBus?: IEventBus;

  constructor(adapter: DatabaseAdapter, eventBus?: IEventBus) {
    this.db = adapter;
    this.logger = new Logger({ component: 'MemoryEngine' });
    this.eventBus = eventBus;
  }

  // ==== INITIALIZATION ====

  async initialize(): Promise<void> {
    const timer = this.logger.startTimer('Database initialization');

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id          TEXT PRIMARY KEY,
        started_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at    DATETIME,
        channel     TEXT NOT NULL DEFAULT 'web',
        summary     TEXT,
        mood        TEXT,
        message_count INTEGER DEFAULT 0,
        total_tokens  INTEGER DEFAULT 0
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tokens_used     INTEGER,
        brain_provider  TEXT,
        body_executor   TEXT,
        correlation_id  TEXT
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id              TEXT PRIMARY KEY,
        category        TEXT NOT NULL,
        key             TEXT NOT NULL,
        value           TEXT NOT NULL,
        confidence      REAL DEFAULT 1.0,
        source          TEXT,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at      DATETIME,
        access_count    INTEGER DEFAULT 0,
        last_accessed_at DATETIME,
        UNIQUE(category, key)
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS actions (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT REFERENCES conversations(id),
        type            TEXT NOT NULL,
        autonomy_level  INTEGER NOT NULL,
        status          TEXT NOT NULL,
        description     TEXT NOT NULL,
        input_data      TEXT,
        output_data     TEXT,
        error_data      TEXT,
        retry_count     INTEGER DEFAULT 0,
        approved_at     DATETIME,
        executed_at     DATETIME,
        duration_ms     INTEGER,
        token_cost_usd  REAL,
        correlation_id  TEXT,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id            TEXT PRIMARY KEY,
        date          TEXT NOT NULL,
        model         TEXT NOT NULL,
        input_tokens  INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd      REAL NOT NULL,
        action_id     TEXT,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_know_cat ON knowledge(category)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_know_cat_key ON knowledge(category, key)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_know_access ON knowledge(access_count DESC)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_act_status ON actions(status)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_act_corr ON actions(correlation_id)`);
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_token_date ON token_usage(date)`);

    timer();
  }

  // ==== CONVERSATIONS ====

  async startConversation(channel: string): Promise<string> {
    const id = randomUUID();
    await this.db.run('INSERT INTO conversations (id, channel) VALUES (?, ?)', [id, channel]);
    this.logger.info('Conversation started', { conversationId: id, channel });
    return id;
  }

  async endConversation(id: string, summary?: string): Promise<void> {
    await this.db.run(
      'UPDATE conversations SET ended_at = CURRENT_TIMESTAMP, summary = ? WHERE id = ?',
      [summary ?? null, id],
    );
  }

  // ==== MESSAGES ====

  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    const id = randomUUID();
    await this.db.run(
      `INSERT INTO messages (id, conversation_id, role, content, correlation_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, conversationId, message.role, message.content, message.correlationId],
    );

    await this.db.run(
      'UPDATE conversations SET message_count = message_count + 1 WHERE id = ?',
      [conversationId],
    );

    return id;
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    return this.db.all<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
      [conversationId, limit],
    );
  }

  /**
   * Retorna mensagens recentes de QUALQUER conversa — pra context window.
   * Ordenado por recência, limitado por token estimate.
   */
  async getRecentContext(maxTokenEstimate: number): Promise<Message[]> {
    // ~4 chars per token estimate
    const maxChars = maxTokenEstimate * 4;
    const messages = await this.db.all<Message>(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT 200',
    );

    let totalChars = 0;
    const result: Message[] = [];
    for (const msg of messages) {
      totalChars += msg.content.length;
      if (totalChars > maxChars) break;
      result.push(msg);
    }

    return result.reverse(); // Chronological order
  }

  // ==== KNOWLEDGE ====

  async learn(
    category: KnowledgeCategory,
    key: string,
    value: string,
    source?: string,
    confidence = 1.0,
  ): Promise<string> {
    const id = randomUUID();
    await this.db.run(
      `INSERT INTO knowledge (id, category, key, value, confidence, source, last_accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(category, key) DO UPDATE SET
         value = excluded.value,
         confidence = excluded.confidence,
         source = excluded.source,
         updated_at = CURRENT_TIMESTAMP`,
      [id, category, key, value, confidence, source ?? null],
    );

    this.logger.debug('Knowledge learned', { category, key, confidence });
    return id;
  }

  async recall(category?: KnowledgeCategory, query?: string, limit = 20): Promise<KnowledgeEntry[]> {
    let sql = 'SELECT * FROM knowledge WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (query) {
      sql += ' AND (key LIKE ? OR value LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    // Filter expired
    sql += ' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';
    sql += ' ORDER BY confidence DESC, access_count DESC LIMIT ?';
    params.push(limit);

    const results = await this.db.all<KnowledgeEntry>(sql, params);

    // Track access
    for (const entry of results) {
      await this.db.run(
        'UPDATE knowledge SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [entry.id],
      );
    }

    return results;
  }

  /**
   * Decai confiança de conhecimento antigo não acessado.
   * Roda diariamente. Info que Gregory nunca pergunta perde relevância.
   */
  async decayConfidence(daysThreshold = 30, decayFactor = 0.95): Promise<number> {
    const result = await this.db.run(
      `UPDATE knowledge SET confidence = confidence * ?
       WHERE last_accessed_at < datetime('now', '-' || ? || ' days')
       AND confidence > 0.1`,
      [decayFactor, daysThreshold],
    );
    this.logger.info('Confidence decay applied', { daysThreshold, decayFactor });
    return 0; // Would return affected rows count with proper adapter
  }

  // ==== ACTIONS ====

  async recordAction(action: Action): Promise<void> {
    await this.db.run(
      `INSERT INTO actions (id, conversation_id, type, autonomy_level, status, description,
        input_data, output_data, error_data, retry_count, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        null,
        action.type,
        action.autonomyLevel,
        action.status,
        action.description,
        action.input ? JSON.stringify(action.input) : null,
        action.output ? JSON.stringify(action.output) : null,
        action.error ? JSON.stringify(action.error) : null,
        action.retryCount,
        action.correlationId,
      ],
    );
  }

  async updateActionStatus(actionId: string, status: string, output?: Record<string, unknown>): Promise<void> {
    await this.db.run(
      `UPDATE actions SET status = ?, output_data = ?,
       executed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE executed_at END
       WHERE id = ?`,
      [status, output ? JSON.stringify(output) : null, status, actionId],
    );
  }

  async getPendingActions(): Promise<Action[]> {
    return this.db.all<Action>(
      "SELECT * FROM actions WHERE status = 'pending_approval' ORDER BY created_at ASC",
    );
  }

  // ==== TOKEN USAGE ====

  async recordTokenUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUSD: number,
    actionId?: string,
  ): Promise<void> {
    const id = randomUUID();
    const date = new Date().toISOString().split('T')[0];
    await this.db.run(
      'INSERT INTO token_usage (id, date, model, input_tokens, output_tokens, cost_usd, action_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, date, model, inputTokens, outputTokens, costUSD, actionId ?? null],
    );
  }

  async getDailyTokenUsage(date?: string): Promise<{ totalInput: number; totalOutput: number; totalCostUSD: number }> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const result = await this.db.get<{ totalInput: number; totalOutput: number; totalCostUSD: number }>(
      'SELECT SUM(input_tokens) as totalInput, SUM(output_tokens) as totalOutput, SUM(cost_usd) as totalCostUSD FROM token_usage WHERE date = ?',
      [d],
    );
    return result ?? { totalInput: 0, totalOutput: 0, totalCostUSD: 0 };
  }

  // ==== EXPORT / IMPORT ====

  async exportMemory(): Promise<AuraMemoryExport> {
    const timer = this.logger.startTimer('Memory export');

    const [conversations, messages, knowledge, actions, tokenUsage] = await Promise.all([
      this.db.all('SELECT * FROM conversations'),
      this.db.all('SELECT * FROM messages'),
      this.db.all('SELECT * FROM knowledge'),
      this.db.all('SELECT * FROM actions'),
      this.db.all('SELECT * FROM token_usage'),
    ]);

    const data = { conversations, messages, knowledge, actions, tokenUsage };
    const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');

    const exportData: AuraMemoryExport = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      checksum,
      ...data,
    };

    this.eventBus?.emit({
      type: 'memory.exported',
      payload: {
        checksum,
        sizeBytes: JSON.stringify(exportData).length,
      },
    });

    timer();
    return exportData;
  }

  async importMemory(data: AuraMemoryExport): Promise<{ imported: number; skipped: number }> {
    // Verify checksum
    const { checksum, version, exportedAt, ...tables } = data;
    const computedChecksum = createHash('sha256').update(JSON.stringify(tables)).digest('hex');

    if (computedChecksum !== checksum) {
      throw new Error(
        `Memory import REJECTED: checksum mismatch. Expected ${checksum}, got ${computedChecksum}. Data may be corrupted.`,
      );
    }

    this.logger.info('Memory import started', { version, exportedAt, checksum });

    let imported = 0;
    let skipped = 0;

    // Import knowledge (most important)
    for (const entry of (tables.knowledge as any[]) ?? []) {
      try {
        await this.learn(entry.category, entry.key, entry.value, entry.source, entry.confidence);
        imported++;
      } catch {
        skipped++;
      }
    }

    this.eventBus?.emit({ type: 'memory.imported', payload: { imported, skipped } });
    this.logger.info('Memory import complete', { imported, skipped });

    return { imported, skipped };
  }

  // ==== HEALTH ====

  async getHealth(): Promise<MemoryHealth> {
    const [convCount, knowCount, actCount] = await Promise.all([
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM conversations'),
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM knowledge'),
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM actions'),
    ]);

    return {
      status: 'healthy',
      totalConversations: convCount?.count ?? 0,
      totalKnowledge: knowCount?.count ?? 0,
      totalActions: actCount?.count ?? 0,
      sizeBytes: 0, // Would query file size for SQLite
      oldestEntry: new Date(),
      newestEntry: new Date(),
    };
  }

  async close(): Promise<void> {
    await this.db.close();
    this.logger.info('Memory engine closed');
  }
}
