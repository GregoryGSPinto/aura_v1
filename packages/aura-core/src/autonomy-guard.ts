/**
 * AURA Autonomy Guard v2.0
 *
 * A ÚNICA coisa que impede Aura de causar dano irreversível.
 * Este código é SAGRADO. Mudanças aqui precisam de:
 * 1. PR review (mesmo sendo solo dev — discipline matters)
 * 2. Todos os testes passando
 * 3. Changelog no ADR-003
 *
 * REGRAS IMUTÁVEIS:
 * - L3 é HARDCODED. Não existe promote() de L3 → L2.
 * - L3 patterns não são configuráveis em runtime.
 * - Se em dúvida, classifica como L2 (pedir aprovação > causar dano).
 *
 * @see ADR-003: Autonomy Guard
 * @author Gregory — AI Solution Architect
 */

import type {
  Action,
  AutonomyLevel,
  IEventBus,
  RequestContext,
} from './interfaces.js';

// ============================================================
// L3 PATTERNS — HARDCODED, IMUTÁVEIS, INTOCÁVEIS
// ============================================================

/**
 * Ações que Aura NUNCA pode executar sozinha.
 * Estes patterns são verificados por string matching E regex.
 * Redundância é intencional — defense in depth.
 */
const L3_BLOCKED_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reason: string;
  category: string;
}> = Object.freeze([
  // === FINANCEIRO ===
  { pattern: /\b(transfer|transferir|pix|wire|payment|pagamento)\b/i, reason: 'Financial transfer detected', category: 'financial' },
  { pattern: /\b(purchase|compra|buy|comprar|checkout)\b/i, reason: 'Purchase action detected', category: 'financial' },
  { pattern: /\b(invest|investir|trade|trading|crypto|bitcoin|eth)\b/i, reason: 'Investment/trading detected', category: 'financial' },
  { pattern: /\b(bank|banco|account\s*number|conta\s*bancária)\b/i, reason: 'Banking operation detected', category: 'financial' },
  { pattern: /\b(credit\s*card|cartão|cvv|billing)\b/i, reason: 'Credit card operation detected', category: 'financial' },
  { pattern: /\b(subscription|assinatura|subscribe|recurring\s*payment)\b/i, reason: 'Subscription/recurring payment detected', category: 'financial' },

  // === LEGAL ===
  { pattern: /\b(contract|contrato|sign|assinar|agreement|termo)\b/i, reason: 'Legal document/signing detected', category: 'legal' },
  { pattern: /\b(lawsuit|processo|legal\s*action|ação\s*judicial)\b/i, reason: 'Legal action detected', category: 'legal' },
  { pattern: /\b(nda|non.?disclosure|confidential\s*agreement)\b/i, reason: 'NDA/confidential agreement detected', category: 'legal' },

  // === IRREVERSÍVEL ===
  { pattern: /\b(delete\s*account|deletar\s*conta|close\s*account|encerrar)\b/i, reason: 'Account deletion detected', category: 'irreversible' },
  { pattern: /\b(drop\s*(table|database)|truncate|rm\s+-rf)\b/i, reason: 'Data destruction detected', category: 'irreversible' },
  { pattern: /\b(format|wipe|factory\s*reset)\b/i, reason: 'Data wipe detected', category: 'irreversible' },
  { pattern: /\b(unsubscribe\s*all|opt.?out\s*all|revoke\s*all)\b/i, reason: 'Mass revocation detected', category: 'irreversible' },

  // === CREDENCIAIS ===
  { pattern: /\b(password|senha|api.?key|secret|token|credential)\b/i, reason: 'Credential manipulation detected', category: 'security' },
  { pattern: /\b(ssh|private.?key|certificate|cert)\b/i, reason: 'Security credential detected', category: 'security' },
  { pattern: /\b(2fa|mfa|authenticator|recovery\s*code)\b/i, reason: '2FA/MFA operation detected', category: 'security' },

  // === REPUTAÇÃO ===
  { pattern: /\b(public\s*post|tweet|publish|publicar|broadcast)\b/i, reason: 'Public broadcast detected', category: 'reputation' },
  { pattern: /\b(reply\s*all|mass\s*email|bulk\s*send|spam)\b/i, reason: 'Mass communication detected', category: 'reputation' },

  // === VALE/EFVM — contexto profissional ===
  { pattern: /\b(vale|efvm|ferrovia|railway|estrada\s*de\s*ferro)\b/i, reason: 'Professional/employer context detected', category: 'professional' },
]) as ReadonlyArray<{ pattern: RegExp; reason: string; category: string }>;

/**
 * Action types que são SEMPRE L3, independente do conteúdo.
 * Belt and suspenders — mesmo se o regex falhar.
 */
const L3_BLOCKED_TYPES: ReadonlySet<string> = Object.freeze(
  new Set([
    'financial_transfer',
    'purchase',
    'investment',
    'contract_sign',
    'account_delete',
    'data_destroy',
    'credential_change',
    'public_post',
    'mass_email',
    'legal_action',
  ]),
) as ReadonlySet<string>;

// ============================================================
// L2 PATTERNS — Requerem aprovação do Gregory
// ============================================================

const L2_DEFAULT_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  { pattern: /\b(email|send|enviar|message|mensagem)\b/i, reason: 'External communication' },
  { pattern: /\b(apply|candidatar|submit|submeter)\b/i, reason: 'Application/submission' },
  { pattern: /\b(schedule|agendar|meeting|reunião|calendar)\b/i, reason: 'Calendar modification' },
  { pattern: /\b(register|cadastrar|signup|criar\s*conta)\b/i, reason: 'Account creation' },
  { pattern: /\b(download|install|instalar)\b/i, reason: 'Software installation' },
  { pattern: /\b(share|compartilhar|invite|convidar)\b/i, reason: 'Sharing/inviting' },
  { pattern: /\b(update|atualizar|modify|modificar|edit|editar)\b/i, reason: 'Content modification' },
];

// ============================================================
// PROMOTIONS — L2 → L1 que Gregory aprovou
// ============================================================

interface Promotion {
  actionPattern: string;
  promotedAt: Date;
  reason: string;
  promotedBy: 'gregory';
}

// ============================================================
// AUTONOMY GUARD CLASS
// ============================================================

export class AutonomyGuard {
  private promotions: Map<string, Promotion> = new Map();
  private classificationHistory: Array<{
    action: string;
    level: AutonomyLevel;
    reason: string;
    timestamp: Date;
  }> = [];
  private readonly eventBus?: IEventBus;

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Classifica uma ação no nível de autonomia correto.
   *
   * ORDEM DE AVALIAÇÃO (NÃO MUDA):
   * 1. L3 hardcoded type check
   * 2. L3 hardcoded pattern check
   * 3. L2 promotion check (pode ter sido promovido pra L1)
   * 4. L2 default patterns
   * 5. Default: L1 (pesquisa, organização, análise)
   */
  classify(action: Action): { level: AutonomyLevel; reason: string; blocked: boolean } {
    // === STEP 1: L3 by type (mais rápido, verifica primeiro) ===
    if (L3_BLOCKED_TYPES.has(action.type)) {
      const result = {
        level: 3 as AutonomyLevel,
        reason: `Blocked type: ${action.type}`,
        blocked: true,
      };
      this.record(action, result);
      return result;
    }

    // === STEP 2: L3 by pattern (content scan) ===
    const actionText = `${action.type} ${action.description} ${JSON.stringify(action.input ?? {})}`;

    for (const { pattern, reason, category } of L3_BLOCKED_PATTERNS) {
      if (pattern.test(actionText)) {
        const result = {
          level: 3 as AutonomyLevel,
          reason: `L3 [${category}]: ${reason}`,
          blocked: true,
        };
        this.record(action, result);
        return result;
      }
    }

    // === STEP 3: Check promotions (L2 → L1) ===
    const promotion = this.promotions.get(action.type);
    if (promotion) {
      const result = {
        level: 1 as AutonomyLevel,
        reason: `Promoted from L2: ${promotion.reason}`,
        blocked: false,
      };
      this.record(action, result);
      return result;
    }

    // === STEP 4: L2 default patterns ===
    for (const { pattern, reason } of L2_DEFAULT_PATTERNS) {
      if (pattern.test(actionText)) {
        const result = {
          level: 2 as AutonomyLevel,
          reason: `Requires approval: ${reason}`,
          blocked: false,
        };
        this.record(action, result);
        return result;
      }
    }

    // === STEP 5: Default L1 ===
    const result = {
      level: 1 as AutonomyLevel,
      reason: 'Autonomous action — research/analysis/organization',
      blocked: false,
    };
    this.record(action, result);
    return result;
  }

  /**
   * Promove ação de L2 → L1.
   * NUNCA de L3. L3 é hardcoded. Isso é enforcement, não sugestão.
   *
   * @throws Error se tentar promover ação L3
   */
  promote(actionType: string, reason: string): void {
    // SECURITY: Verificar se o tipo é L3
    if (L3_BLOCKED_TYPES.has(actionType)) {
      throw new AutonomyViolationError(
        `SECURITY VIOLATION: Cannot promote L3 action type "${actionType}". L3 is HARDCODED.`,
      );
    }

    // SECURITY: Verificar se o conteúdo match L3 patterns
    for (const { pattern, category } of L3_BLOCKED_PATTERNS) {
      if (pattern.test(actionType)) {
        throw new AutonomyViolationError(
          `SECURITY VIOLATION: Action type "${actionType}" matches L3 pattern [${category}]. Cannot promote.`,
        );
      }
    }

    this.promotions.set(actionType, {
      actionPattern: actionType,
      promotedAt: new Date(),
      reason,
      promotedBy: 'gregory',
    });
  }

  /**
   * Revoga promoção — volta pra L2.
   */
  demote(actionType: string): boolean {
    return this.promotions.delete(actionType);
  }

  /**
   * Lista todas as promoções ativas.
   */
  getPromotions(): ReadonlyMap<string, Promotion> {
    return this.promotions;
  }

  /**
   * Histórico de classificações — audit trail.
   */
  getHistory(limit = 100) {
    return this.classificationHistory.slice(-limit);
  }

  /**
   * Valida integridade dos L3 patterns.
   * Útil pra testes: verifica que ninguém alterou os patterns.
   */
  static validateL3Integrity(): {
    patternCount: number;
    typeCount: number;
    categories: string[];
  } {
    return {
      patternCount: L3_BLOCKED_PATTERNS.length,
      typeCount: L3_BLOCKED_TYPES.size,
      categories: [...new Set(L3_BLOCKED_PATTERNS.map((p) => p.category))],
    };
  }

  /**
   * Retorna todos os L3 patterns — read-only, pra auditoria.
   */
  static getL3Patterns(): ReadonlyArray<{ pattern: string; reason: string; category: string }> {
    return L3_BLOCKED_PATTERNS.map((p) => ({
      pattern: p.pattern.source,
      reason: p.reason,
      category: p.category,
    }));
  }

  private record(
    action: Action,
    result: { level: AutonomyLevel; reason: string },
  ): void {
    this.classificationHistory.push({
      action: `${action.type}: ${action.description}`,
      level: result.level,
      reason: result.reason,
      timestamp: new Date(),
    });

    // Emit events
    if (result.level === 3) {
      this.eventBus?.emit({
        type: 'action.blocked',
        payload: { ...action, status: 'blocked' },
      });
    } else {
      this.eventBus?.emit({
        type: 'action.classified',
        payload: { ...action, level: result.level },
      });
    }
  }
}

export class AutonomyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutonomyViolationError';
  }
}
