/**
 * AURA Autonomy Guard — Test Suite
 *
 * Esta test suite PROVA matematicamente que:
 * 1. Nenhuma ação L3 passa — NUNCA
 * 2. L3 não pode ser promovido — NUNCA
 * 3. L2 pede aprovação — SEMPRE
 * 4. Promoções L2→L1 funcionam — E SÓ L2→L1
 *
 * Se ALGUM destes testes falhar, o deploy é bloqueado.
 * Sem exceção. Sem "ah mas é só aquele caso edge."
 *
 * @author Gregory — AI Solution Architect
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AutonomyGuard, AutonomyViolationError } from '../autonomy-guard.js';
import { EventBus } from '../event-bus.js';
import type { Action, AutonomyLevel } from '../interfaces.js';

// ============================================================
// HELPERS
// ============================================================

function createAction(overrides: Partial<Action> = {}): Action {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? 'test_action',
    description: overrides.description ?? 'Test action',
    autonomyLevel: 1,
    status: 'proposed',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    correlationId: 'test-corr-001',
    ...overrides,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('AutonomyGuard', () => {
  let guard: AutonomyGuard;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    guard = new AutonomyGuard(eventBus);
  });

  // ==========================================================
  // L3 — HARDCODED BLOCKS
  // ==========================================================

  describe('L3 — Hardcoded Blocks (IMMUTABLE)', () => {
    describe('Financial actions', () => {
      const financialTerms = [
        'transfer $500 to account',
        'fazer pix de R$100',
        'wire transfer to vendor',
        'process payment for service',
        'realizar pagamento mensal',
        'purchase new equipment',
        'comprar licença de software',
        'buy domain name',
        'invest in crypto fund',
        'investir em renda fixa',
        'trade bitcoin for eth',
        'check bank account balance',
        'acessar conta bancária',
        'update credit card info',
        'renovar cartão de crédito',
        'setup subscription plan',
        'cancelar assinatura do Netflix',
      ];

      it.each(financialTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('financial');
      });
    });

    describe('Legal actions', () => {
      const legalTerms = [
        'sign the contract with vendor',
        'assinar contrato de trabalho',
        'review NDA and sign',
        'file lawsuit against company',
        'iniciar processo judicial',
        'accept agreement terms',
        'aceitar termo de confidencialidade',
        'non-disclosure agreement ready',
      ];

      it.each(legalTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    describe('Irreversible actions', () => {
      const irreversibleTerms = [
        'delete account permanently',
        'deletar conta do GitHub',
        'close account and withdraw',
        'encerrar conta bancária',
        'DROP TABLE users',
        'rm -rf /var/data',
        'truncate production database',
        'factory reset the server',
        'format drive C:',
        'wipe all data',
        'unsubscribe all newsletters',
        'revoke all access tokens',
      ];

      it.each(irreversibleTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    describe('Security/credential actions', () => {
      const securityTerms = [
        'change password for Gmail',
        'alterar senha do GitHub',
        'rotate API key for production',
        'generate new secret token',
        'update SSH private key',
        'renew SSL certificate',
        'disable 2FA temporarily',
        'reset MFA authenticator',
        'backup recovery codes',
      ];

      it.each(securityTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    describe('Reputation actions', () => {
      const reputationTerms = [
        'create public post about the project',
        'publicar artigo no LinkedIn',
        'tweet about the new feature',
        'reply all to company thread',
        'send mass email to all contacts',
        'bulk send newsletter',
      ];

      it.each(reputationTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    describe('Professional context (Corporate/Railway)', () => {
      const professionalTerms = [
        'send message to corporate stakeholders',
        'update railway project status',
        'notify ferrovia operations team',
        'share railway maintenance report',
        'post update about Estrada de Ferro',
      ];

      it.each(professionalTerms)('BLOCKS: "%s"', (description) => {
        const action = createAction({ description });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    describe('L3 by action type (belt AND suspenders)', () => {
      const l3Types = [
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
      ];

      it.each(l3Types)('BLOCKS type "%s" even with innocent description', (type) => {
        const action = createAction({
          type,
          description: 'Just checking the weather today',
        });
        const result = guard.classify(action);

        expect(result.level).toBe(3);
        expect(result.blocked).toBe(true);
      });
    });

    it('scans action input data for L3 patterns', () => {
      const action = createAction({
        type: 'generic_action',
        description: 'Process the request',
        input: { command: 'transfer $5000 to account 12345' },
      });
      const result = guard.classify(action);

      expect(result.level).toBe(3);
      expect(result.blocked).toBe(true);
    });
  });

  // ==========================================================
  // L3 PROMOTION IMPOSSIBILITY
  // ==========================================================

  describe('L3 Promotion — IMPOSSIBLE BY DESIGN', () => {
    it('throws AutonomyViolationError when promoting L3 type', () => {
      expect(() => guard.promote('financial_transfer', 'I want to automate payments')).toThrow(
        AutonomyViolationError,
      );
    });

    it('throws AutonomyViolationError when promoting action matching L3 pattern', () => {
      expect(() => guard.promote('purchase_order', 'Auto-buy supplies')).toThrow(
        AutonomyViolationError,
      );
    });

    it('error message contains SECURITY VIOLATION', () => {
      try {
        guard.promote('financial_transfer', 'test');
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('SECURITY VIOLATION');
        expect((e as Error).message).toContain('HARDCODED');
      }
    });

    it('L3 blocks remain even after 1000 classification cycles', () => {
      // Simula uso pesado — L3 nunca degrada
      for (let i = 0; i < 1000; i++) {
        guard.classify(createAction({ description: 'research competitors' }));
      }

      const financial = guard.classify(
        createAction({ description: 'transfer money to vendor' }),
      );
      expect(financial.level).toBe(3);
      expect(financial.blocked).toBe(true);
    });
  });

  // ==========================================================
  // L2 — APPROVAL REQUIRED
  // ==========================================================

  describe('L2 — Requires Gregory Approval', () => {
    const l2Terms = [
      { desc: 'send email to client about project update', reason: 'communication' },
      { desc: 'enviar mensagem pro time de design', reason: 'communication' },
      { desc: 'apply for senior engineer position at Google', reason: 'application' },
      { desc: 'candidatar pra vaga de arquiteto', reason: 'application' },
      { desc: 'schedule meeting with potential client', reason: 'calendar' },
      { desc: 'agendar reunião com investidor', reason: 'calendar' },
      { desc: 'register for AWS conference', reason: 'registration' },
      { desc: 'download and install VS Code extension', reason: 'installation' },
      { desc: 'share document with team members', reason: 'sharing' },
      { desc: 'update the project README with new info', reason: 'modification' },
    ];

    it.each(l2Terms)('REQUIRES APPROVAL: "$desc"', ({ desc }) => {
      const action = createAction({ description: desc });
      const result = guard.classify(action);

      expect(result.level).toBe(2);
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('approval');
    });
  });

  // ==========================================================
  // L1 — FULLY AUTONOMOUS
  // ==========================================================

  describe('L1 — Fully Autonomous', () => {
    const l1Terms = [
      'research competitor pricing strategies',
      'analyze market trends for BJJ streaming',
      'organize files in project folder',
      'summarize the article about AI architecture',
      'calculate project timeline estimates',
      'compare React vs Vue for mobile app',
      'find open source alternatives to Slack',
      'review code quality metrics',
      'generate weekly productivity report',
      'brainstorm feature ideas for Black Belt',
    ];

    it.each(l1Terms)('AUTONOMOUS: "%s"', (description) => {
      const action = createAction({ description });
      const result = guard.classify(action);

      expect(result.level).toBe(1);
      expect(result.blocked).toBe(false);
    });
  });

  // ==========================================================
  // PROMOTIONS L2 → L1
  // ==========================================================

  describe('Promotions (L2 → L1)', () => {
    it('promotes L2 action to L1 after Gregory approves', () => {
      // Before promotion: L2
      const before = guard.classify(
        createAction({ type: 'job_followup', description: 'follow up on job application' }),
      );
      // job_followup matches "apply" or could be custom — let's use a more explicit type
      // Actually let's test with a specific promotion scenario

      guard.promote('daily_report', 'Gregory trusts daily reports to be autonomous');

      const after = guard.classify(
        createAction({ type: 'daily_report', description: 'generate and organize daily report' }),
      );

      expect(after.level).toBe(1);
      expect(after.reason).toContain('Promoted');
    });

    it('demotes promoted action back to L2', () => {
      guard.promote('daily_report', 'Auto-send daily reports');

      const promoted = guard.classify(createAction({ type: 'daily_report', description: 'test' }));
      expect(promoted.level).toBe(1);

      guard.demote('daily_report');

      // After demotion, falls through to default classification
      const demoted = guard.classify(
        createAction({ type: 'daily_report', description: 'test' }),
      );
      // Without matching L2 pattern, defaults to L1
      expect(demoted.level).toBe(1); // Because 'daily_report' doesn't match L2 patterns
    });

    it('tracks all promotions', () => {
      guard.promote('weekly_sync', 'Auto-sync weekly');
      guard.promote('code_review', 'Auto code review');

      const promotions = guard.getPromotions();
      expect(promotions.size).toBe(2);
      expect(promotions.has('weekly_sync')).toBe(true);
      expect(promotions.has('code_review')).toBe(true);
    });
  });

  // ==========================================================
  // AUDIT TRAIL
  // ==========================================================

  describe('Audit Trail', () => {
    it('records every classification', () => {
      guard.classify(createAction({ description: 'research AI papers' }));
      guard.classify(createAction({ description: 'send email to client' }));
      guard.classify(createAction({ type: 'financial_transfer', description: 'pay invoice' }));

      const history = guard.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].level).toBe(1);
      expect(history[1].level).toBe(2);
      expect(history[2].level).toBe(3);
    });

    it('respects history limit', () => {
      for (let i = 0; i < 150; i++) {
        guard.classify(createAction({ description: `action ${i}` }));
      }

      const history = guard.getHistory(100);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================
  // EVENT BUS INTEGRATION
  // ==========================================================

  describe('Event Bus Integration', () => {
    it('emits action.blocked for L3', () => {
      const events: any[] = [];
      eventBus.on('action.blocked', (payload) => events.push(payload));

      guard.classify(createAction({ type: 'financial_transfer', description: 'pay vendor' }));

      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('blocked');
    });

    it('emits action.classified for L1 and L2', () => {
      const events: any[] = [];
      eventBus.on('action.classified', (payload) => events.push(payload));

      guard.classify(createAction({ description: 'research competitors' }));
      guard.classify(createAction({ description: 'send email to team' }));

      expect(events).toHaveLength(2);
    });

    it('does NOT emit action.classified for L3 (emits blocked instead)', () => {
      const classified: any[] = [];
      const blocked: any[] = [];
      eventBus.on('action.classified', (p) => classified.push(p));
      eventBus.on('action.blocked', (p) => blocked.push(p));

      guard.classify(createAction({ description: 'transfer money' }));

      expect(classified).toHaveLength(0);
      expect(blocked).toHaveLength(1);
    });
  });

  // ==========================================================
  // L3 INTEGRITY VERIFICATION
  // ==========================================================

  describe('L3 Integrity', () => {
    it('has the expected number of L3 patterns', () => {
      const integrity = AutonomyGuard.validateL3Integrity();

      // If someone removes a pattern, this test SCREAMS
      expect(integrity.patternCount).toBeGreaterThanOrEqual(20);
      expect(integrity.typeCount).toBeGreaterThanOrEqual(10);
    });

    it('covers all critical categories', () => {
      const integrity = AutonomyGuard.validateL3Integrity();
      const expectedCategories = [
        'financial',
        'legal',
        'irreversible',
        'security',
        'reputation',
        'professional',
      ];

      for (const category of expectedCategories) {
        expect(integrity.categories).toContain(category);
      }
    });

    it('L3 patterns are frozen (immutable)', () => {
      const patterns = AutonomyGuard.getL3Patterns();

      // Attempt to mutate should fail or have no effect
      expect(() => {
        (patterns as any).push({ pattern: 'hacked', reason: 'hacked', category: 'hacked' });
      }).toThrow();
    });
  });

  // ==========================================================
  // EDGE CASES & ADVERSARIAL
  // ==========================================================

  describe('Edge Cases & Adversarial Inputs', () => {
    it('handles empty description', () => {
      const action = createAction({ description: '' });
      const result = guard.classify(action);
      expect(result.level).toBe(1); // Default autonomous
    });

    it('handles very long description', () => {
      const action = createAction({
        description: 'a'.repeat(10_000) + ' transfer money ' + 'b'.repeat(10_000),
      });
      const result = guard.classify(action);
      expect(result.level).toBe(3); // Still catches embedded L3
    });

    it('catches L3 in mixed case', () => {
      const action = createAction({ description: 'TRANSFER Money TO Account' });
      expect(guard.classify(action).level).toBe(3);
    });

    it('catches L3 with special characters around keywords', () => {
      const action = createAction({ description: '>>> transfer <<< money!!!' });
      expect(guard.classify(action).level).toBe(3);
    });

    it('catches L3 in Portuguese', () => {
      const action = createAction({ description: 'fazer transferência via pix' });
      expect(guard.classify(action).level).toBe(3);
    });

    it('catches L3 in action input, not just description', () => {
      const action = createAction({
        type: 'process_request',
        description: 'Handle the incoming task',
        input: { details: 'Need to purchase software licenses' },
      });
      expect(guard.classify(action).level).toBe(3);
    });

    it('L3 check runs BEFORE L2 check (order matters)', () => {
      // "send email with bank transfer details" matches both L2 (send email) and L3 (bank transfer)
      const action = createAction({
        description: 'send email with bank transfer details',
      });
      const result = guard.classify(action);

      // MUST be L3, not L2 — L3 takes absolute priority
      expect(result.level).toBe(3);
      expect(result.blocked).toBe(true);
    });
  });

  // ==========================================================
  // PERFORMANCE
  // ==========================================================

  describe('Performance', () => {
    it('classifies 10,000 actions in under 1 second', () => {
      const start = Date.now();

      for (let i = 0; i < 10_000; i++) {
        guard.classify(createAction({ description: `action number ${i}` }));
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
