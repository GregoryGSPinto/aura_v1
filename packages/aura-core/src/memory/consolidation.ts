/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  MEMORY CONSOLIDATION ENGINE                             ║
 * ║  Aura's equivalent of sleep. Periodically:               ║
 * ║  1. Summarizes old conversations (saves tokens)          ║
 * ║  2. Extracts knowledge from conversations                ║
 * ║  3. Decays low-confidence knowledge                      ║
 * ║  4. Expires stale entries                                ║
 * ║  5. Computes knowledge graph connections                 ║
 * ║                                                          ║
 * ║  Without this, memory grows unbounded and API costs      ║
 * ║  scale linearly with history. With this, costs stay      ║
 * ║  flat while knowledge compounds.                         ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import type {
  IBrain,
  Message,
  KnowledgeEntry,
  ConsolidationResult,
} from '../types/index.js';

export interface ConsolidationConfig {
  maxUnconsolidatedConversations: number;
  knowledgeDecayRate: number;        // confidence reduction per cycle (0.01 = 1%)
  minConfidenceThreshold: number;    // below this → mark for expiration
  staleDays: number;                 // knowledge not accessed in N days → decay
  maxContextTokens: number;          // target token budget for injected context
  summaryMaxTokens: number;          // max tokens per conversation summary
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  maxUnconsolidatedConversations: 20,
  knowledgeDecayRate: 0.05,
  minConfidenceThreshold: 0.3,
  staleDays: 30,
  maxContextTokens: 4000,
  summaryMaxTokens: 200,
};

// ── Abstract storage interface (decoupled from SQLite) ──────

export interface IMemoryStore {
  getUnconsolidatedConversations(limit: number): Promise<Array<{
    id: string;
    messages: Message[];
    startedAt: Date;
  }>>;
  saveConversationSummary(conversationId: string, summary: string): Promise<void>;
  markConversationConsolidated(conversationId: string): Promise<void>;
  getAllKnowledge(): Promise<KnowledgeEntry[]>;
  upsertKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
  updateKnowledgeConfidence(id: string, newConfidence: number): Promise<void>;
  expireKnowledge(id: string): Promise<void>;
  getKnowledgeAccessStats(): Promise<Array<{ id: string; lastAccessedAt: Date | null; accessCount: number }>>;
}

export class MemoryConsolidator {
  private config: ConsolidationConfig;
  private store: IMemoryStore;
  private brain: IBrain;
  private lastConsolidation: Date | null = null;

  constructor(store: IMemoryStore, brain: IBrain, config?: Partial<ConsolidationConfig>) {
    this.store = store;
    this.brain = brain;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run a full consolidation cycle.
   * Should be called periodically (e.g., nightly cron or after N conversations).
   */
  async consolidate(): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      conversationsProcessed: 0,
      knowledgeExtracted: 0,
      knowledgeUpdated: 0,
      knowledgeExpired: 0,
      tokensSaved: 0,
      consolidatedAt: new Date(),
    };

    // PHASE 1: Summarize old conversations
    const conversations = await this.store.getUnconsolidatedConversations(
      this.config.maxUnconsolidatedConversations,
    );

    for (const conv of conversations) {
      if (conv.messages.length < 2) continue;

      const originalTokens = this.estimateTokens(conv.messages.map(m => m.content).join('\n'));
      const summary = await this.summarizeConversation(conv.messages);

      await this.store.saveConversationSummary(conv.id, summary);
      await this.store.markConversationConsolidated(conv.id);

      const summaryTokens = this.estimateTokens(summary);
      result.tokensSaved += originalTokens - summaryTokens;
      result.conversationsProcessed++;

      // Extract knowledge from conversation
      const extracted = await this.extractKnowledge(conv.messages);
      for (const entry of extracted) {
        await this.store.upsertKnowledge(entry);
        result.knowledgeExtracted++;
      }
    }

    // PHASE 2: Decay stale knowledge
    const allKnowledge = await this.store.getAllKnowledge();
    const accessStats = await this.store.getKnowledgeAccessStats();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - this.config.staleDays * 86400000);

    for (const stat of accessStats) {
      const knowledge = allKnowledge.find(k => k.id === stat.id);
      if (!knowledge) continue;

      const lastAccess = stat.lastAccessedAt ?? knowledge.createdAt;
      if (lastAccess < staleThreshold) {
        const newConfidence = knowledge.confidence - this.config.knowledgeDecayRate;

        if (newConfidence < this.config.minConfidenceThreshold) {
          await this.store.expireKnowledge(knowledge.id);
          result.knowledgeExpired++;
        } else {
          await this.store.updateKnowledgeConfidence(knowledge.id, newConfidence);
          result.knowledgeUpdated++;
        }
      }
    }

    this.lastConsolidation = result.consolidatedAt;
    return result;
  }

  /**
   * Use Brain to summarize a conversation into a compact form.
   */
  private async summarizeConversation(messages: Message[]): Promise<string> {
    const transcript = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const summary = await this.brain.summarize(messages);
    return summary;
  }

  /**
   * Use Brain to extract structured knowledge from conversation.
   */
  private async extractKnowledge(messages: Message[]): Promise<
    Array<Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>>
  > {
    // In production, this calls Brain with a structured extraction prompt.
    // For the architecture demo, we define the contract clearly.
    const prompt = `Extract key facts, preferences, and decisions from this conversation.
Return as JSON array with: { category, key, value, confidence }
Categories: preference, fact, project, contact, goal, skill, routine, insight`;

    try {
      const response = await this.brain.think(prompt, {
        conversationHistory: messages,
        relevantKnowledge: [],
        pendingActions: [],
        tokenBudget: {
          dailyLimitUSD: 5, monthlyLimitUSD: 50,
          currentDailyUSD: 0, currentMonthlyUSD: 0,
          lastResetDaily: new Date(), lastResetMonthly: new Date(),
        },
        channel: 'web',
      });

      // Parse extracted knowledge from Brain response
      const parsed = this.parseKnowledgeResponse(response.content);
      return parsed.map(k => ({
        ...k,
        source: messages[0]?.id ?? null,
        expiresAt: null,
        accessCount: 0,
        lastAccessedAt: null,
      }));
    } catch {
      // If extraction fails, return empty — don't block consolidation
      return [];
    }
  }

  private parseKnowledgeResponse(content: string): Array<{
    category: KnowledgeEntry['category'];
    key: string;
    value: string;
    confidence: number;
  }> {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  /**
   * Build optimized context for Brain calls.
   * Selects most relevant knowledge within token budget.
   */
  buildContext(query: string, allKnowledge: KnowledgeEntry[]): KnowledgeEntry[] {
    // Score each knowledge entry by relevance to query
    const scored = allKnowledge
      .map(k => ({
        entry: k,
        score: this.relevanceScore(query, k),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // Fill context within token budget
    const selected: KnowledgeEntry[] = [];
    let tokenCount = 0;

    for (const { entry } of scored) {
      const entryTokens = this.estimateTokens(`${entry.key}: ${entry.value}`);
      if (tokenCount + entryTokens > this.config.maxContextTokens) break;
      selected.push(entry);
      tokenCount += entryTokens;
    }

    return selected;
  }

  private relevanceScore(query: string, knowledge: KnowledgeEntry): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const knowledgeText = `${knowledge.key} ${knowledge.value} ${knowledge.category}`.toLowerCase();

    let matchCount = 0;
    for (const word of queryWords) {
      if (word.length > 2 && knowledgeText.includes(word)) matchCount++;
    }

    const termScore = queryWords.length > 0 ? matchCount / queryWords.length : 0;
    const confidenceBoost = knowledge.confidence * 0.3;
    const recencyBoost = knowledge.accessCount > 0 ? Math.min(0.2, knowledge.accessCount * 0.02) : 0;

    return termScore + confidenceBoost + recencyBoost;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  getLastConsolidation(): Date | null {
    return this.lastConsolidation;
  }
}
