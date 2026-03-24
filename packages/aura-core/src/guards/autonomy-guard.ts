/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  AUTONOMY GUARD                                          ║
 * ║  The gatekeeper. Nothing executes without passing here.  ║
 * ║  L3 is hardcoded. Not configurable. Not negotiable.      ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import {
  type Action,
  type AutonomyLevel,
  type LogEntry,
  AUTONOMY_LEVELS,
} from '../types/index.js';

// ── L3 Patterns: HARDCODED. IMMUTABLE. ──────────────────────
// These patterns can NEVER be promoted to L2 or L1.
// Adding new patterns requires a code change + review.
// This is intentional. This is the safety net.

const L3_FORBIDDEN_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  category: string;
  reason: string;
}> = Object.freeze([
  // Financial
  { pattern: /\b(transfer|send|pay|purchase|buy|withdraw|deposit|invest)\b/i, category: 'financial', reason: 'Financial transactions require direct human action' },
  { pattern: /\b(credit.?card|bank.?account|pix|boleto|wire.?transfer)\b/i, category: 'financial', reason: 'Payment instrument operations are never automated' },
  { pattern: /\b(subscribe|subscription|billing|invoice|charge)\b/i, category: 'financial', reason: 'Recurring financial commitments require explicit consent' },

  // Legal
  { pattern: /\b(sign|signature|contract|agreement|terms|legal|lawsuit|sue)\b/i, category: 'legal', reason: 'Legal actions have irreversible consequences' },
  { pattern: /\b(nda|non.?disclosure|intellectual.?property|patent|trademark)\b/i, category: 'legal', reason: 'IP and legal instruments require human judgment' },

  // Identity & Access
  { pattern: /\b(password|credential|api.?key|secret|token|auth|login|2fa|mfa)\b/i, category: 'identity', reason: 'Credential operations are security-critical' },
  { pattern: /\b(delete.?account|deactivate|close.?account|terminate)\b/i, category: 'identity', reason: 'Account lifecycle actions are irreversible' },

  // Reputation
  { pattern: /\b(post.?public|tweet|publish|announce|press.?release)\b/i, category: 'reputation', reason: 'Public statements affect professional reputation' },
  { pattern: /\b(review|rating|testimonial|endorse|recommend.?public)\b/i, category: 'reputation', reason: 'Public endorsements carry reputational weight' },

  // Infrastructure
  { pattern: /\b(deploy.?prod|production.?push|release|rollback.?prod)\b/i, category: 'infrastructure', reason: 'Production deployments require human oversight' },
  { pattern: /\b(drop.?table|delete.?database|truncate|format.?disk)\b/i, category: 'infrastructure', reason: 'Destructive data operations are irreversible' },

  // Personal
  { pattern: /\b(medical|prescription|diagnosis|health.?record)\b/i, category: 'personal', reason: 'Medical decisions require professional human judgment' },
  { pattern: /\b(child|minor|dependent|guardian)\b/i, category: 'personal', reason: 'Actions involving minors require explicit parental action' },
]) as ReadonlyArray<{ pattern: RegExp; category: string; reason: string }>;

// ── L2 Default Patterns (can be promoted to L1 over time) ───

const L2_DEFAULT_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  reason: string;
}> = [
  { pattern: /\b(email|send.?message|contact|reach.?out|dm|message)\b/i, category: 'communication', reason: 'External communications represent Gregory' },
  { pattern: /\b(apply|application|submit|register|signup)\b/i, category: 'commitment', reason: 'Applications create external commitments' },
  { pattern: /\b(schedule|meeting|calendar|appointment|book)\b/i, category: 'scheduling', reason: 'Calendar changes affect others' },
  { pattern: /\b(share|grant.?access|invite|collaborate)\b/i, category: 'access', reason: 'Sharing data requires consent' },
  { pattern: /\b(update.?profile|change.?bio|edit.?resume)\b/i, category: 'identity', reason: 'Profile changes affect professional presence' },
];

// ── Promotion Registry ──────────────────────────────────────
// Tracks which L2 actions Gregory has promoted to L1.
// L3 actions can NEVER appear here. Enforced at runtime.

interface Promotion {
  actionType: string;
  promotedAt: Date;
  reason: string;
  promotedBy: 'gregory'; // Only Gregory can promote. Period.
}

export interface ClassificationResult {
  level: AutonomyLevel;
  reason: string;
  category: string;
  matchedPattern: string | null;
  wasPromoted: boolean;
  confidence: number;
}

export interface GuardAuditEntry {
  actionId: string;
  actionType: string;
  actionDescription: string;
  classification: ClassificationResult;
  timestamp: Date;
  outcome: 'allowed' | 'queued' | 'blocked';
}

export class AutonomyGuard {
  private promotions: Map<string, Promotion> = new Map();
  private auditLog: GuardAuditEntry[] = [];
  private classificationCount = { L1: 0, L2: 0, L3: 0 };
  private onAudit?: (entry: GuardAuditEntry) => void;

  constructor(options?: { onAudit?: (entry: GuardAuditEntry) => void }) {
    this.onAudit = options?.onAudit;
  }

  // ── Core Classification ─────────────────────────────────

  classify(action: Pick<Action, 'id' | 'type' | 'description'>): ClassificationResult {
    const text = `${action.type} ${action.description}`;

    // STEP 1: Check L3 FIRST. Always. No exceptions.
    const l3Match = this.checkL3(text);
    if (l3Match) {
      const result: ClassificationResult = {
        level: AUTONOMY_LEVELS.L3_FORBIDDEN,
        reason: l3Match.reason,
        category: l3Match.category,
        matchedPattern: l3Match.pattern.source,
        wasPromoted: false,
        confidence: 1.0, // L3 is always 100% confident
      };
      this.recordAudit(action, result, 'blocked');
      return result;
    }

    // STEP 2: Check L2 patterns
    const l2Match = this.checkL2(text);
    if (l2Match) {
      // Check if this action type was promoted to L1
      const promotion = this.promotions.get(action.type);
      if (promotion) {
        const result: ClassificationResult = {
          level: AUTONOMY_LEVELS.L1_AUTONOMOUS,
          reason: `Promoted from L2 by Gregory: ${promotion.reason}`,
          category: l2Match.category,
          matchedPattern: l2Match.pattern.source,
          wasPromoted: true,
          confidence: 0.95,
        };
        this.recordAudit(action, result, 'allowed');
        return result;
      }

      const result: ClassificationResult = {
        level: AUTONOMY_LEVELS.L2_APPROVAL,
        reason: l2Match.reason,
        category: l2Match.category,
        matchedPattern: l2Match.pattern.source,
        wasPromoted: false,
        confidence: 0.9,
      };
      this.recordAudit(action, result, 'queued');
      return result;
    }

    // STEP 3: Default to L1 (autonomous) for unmatched actions
    const result: ClassificationResult = {
      level: AUTONOMY_LEVELS.L1_AUTONOMOUS,
      reason: 'No restricted pattern matched — autonomous execution allowed',
      category: 'general',
      matchedPattern: null,
      wasPromoted: false,
      confidence: 0.85,
    };
    this.recordAudit(action, result, 'allowed');
    return result;
  }

  // ── L3 Check (IMMUTABLE) ────────────────────────────────

  private checkL3(text: string) {
    for (const rule of L3_FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(text)) {
        return rule;
      }
    }
    return null;
  }

  // ── L2 Check ────────────────────────────────────────────

  private checkL2(text: string) {
    for (const rule of L2_DEFAULT_PATTERNS) {
      if (rule.pattern.test(text)) {
        return rule;
      }
    }
    return null;
  }

  // ── Promotion System ────────────────────────────────────

  promote(actionType: string, reason: string): { success: boolean; error?: string } {
    // CRITICAL: Verify this action type is NOT L3
    const testText = actionType;
    const l3Match = this.checkL3(testText);
    if (l3Match) {
      return {
        success: false,
        error: `BLOCKED: Cannot promote "${actionType}" — matches L3 forbidden pattern (${l3Match.category}). L3 actions are hardcoded and immutable.`,
      };
    }

    this.promotions.set(actionType, {
      actionType,
      promotedAt: new Date(),
      reason,
      promotedBy: 'gregory',
    });

    return { success: true };
  }

  demote(actionType: string): boolean {
    return this.promotions.delete(actionType);
  }

  getPromotions(): ReadonlyArray<Promotion> {
    return Array.from(this.promotions.values());
  }

  // ── Audit ───────────────────────────────────────────────

  private recordAudit(
    action: Pick<Action, 'id' | 'type' | 'description'>,
    classification: ClassificationResult,
    outcome: 'allowed' | 'queued' | 'blocked'
  ) {
    const level = classification.level === 1 ? 'L1' : classification.level === 2 ? 'L2' : 'L3';
    this.classificationCount[level]++;

    const entry: GuardAuditEntry = {
      actionId: action.id,
      actionType: action.type,
      actionDescription: action.description,
      classification,
      timestamp: new Date(),
      outcome,
    };

    this.auditLog.push(entry);
    this.onAudit?.(entry);
  }

  getAuditLog(): ReadonlyArray<GuardAuditEntry> {
    return [...this.auditLog];
  }

  getStats() {
    return {
      total: this.auditLog.length,
      ...this.classificationCount,
      promotionsActive: this.promotions.size,
      blockRate: this.auditLog.length > 0
        ? (this.classificationCount.L3 / this.auditLog.length * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  // ── Introspection (for testing) ─────────────────────────

  static getL3PatternCount(): number {
    return L3_FORBIDDEN_PATTERNS.length;
  }

  static getL3Categories(): string[] {
    return [...new Set(L3_FORBIDDEN_PATTERNS.map(p => p.category))];
  }
}
