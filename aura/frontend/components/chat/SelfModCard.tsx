'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { handleApproval } from '@/lib/api';

interface SelfModPlan {
  id: string;
  request: string;
  risk_level: string;
  requires_restart: boolean;
  requires_rebuild: boolean;
  files_affected: string[];
  steps: string[];
}

interface SelfModApproval {
  approval_id: string;
  description: string;
  tool: string;
  risk_level: string;
  files_affected: string[];
}

type CardStatus = 'pending' | 'executing' | 'completed' | 'failed';

const RISK_BADGE: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixo', color: 'bg-emerald-500/20 text-emerald-400' },
  medium: { label: 'Médio', color: 'bg-amber-500/20 text-amber-400' },
  high: { label: 'Alto', color: 'bg-red-500/20 text-red-400' },
};

export function SelfModCard({
  plan,
  approvals,
  onApprove,
  onReject,
}: {
  plan: SelfModPlan;
  approvals: SelfModApproval[];
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}) {
  const [status, setStatus] = useState<CardStatus>('pending');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [commitHash, setCommitHash] = useState<string>('');

  const risk = RISK_BADGE[plan.risk_level] ?? RISK_BADGE.low;
  const approvalId = approvals?.[0]?.approval_id ?? plan.id;

  const handleExecute = async () => {
    setStatus('executing');
    try {
      const raw = await handleApproval(approvalId, true);
      const result = raw as { status: string; message?: string; result?: { commit_hash?: string } };
      if (result.status === 'completed') {
        setStatus('completed');
        setResultMessage(result.message ?? 'Concluído');
        setCommitHash(result.result?.commit_hash ?? '');
      } else {
        setStatus('failed');
        setResultMessage(result.message ?? 'Falhou');
      }
    } catch (err) {
      setStatus('failed');
      setResultMessage(err instanceof Error ? err.message : 'Erro desconhecido');
    }
    onApprove?.(approvalId);
  };

  const handleReject = async () => {
    try {
      await handleApproval(approvalId, false);
    } catch {
      // silent
    }
    setStatus('failed');
    setResultMessage('Rejeitado pelo Gregory.');
    onReject?.(approvalId);
  };

  return (
    <div
      className={cn(
        'my-3 rounded-xl border-l-[3px] border border-[rgba(0,212,170,0.15)] p-4',
        'bg-[rgba(0,212,170,0.05)]',
        status === 'completed' && 'border-l-emerald-500 bg-emerald-500/5',
        status === 'failed' && 'border-l-red-500 bg-red-500/5',
        status === 'executing' && 'border-l-amber-500',
      )}
      style={{ borderLeftColor: status === 'pending' ? 'var(--aura-green)' : undefined }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base text-[var(--aura-green)]">✦</span>
          <span className="text-xs font-semibold text-white/80">AUTO-MODIFICAÇÃO DETECTADA</span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', risk.color)}>
          {risk.label}
        </span>
      </div>

      {/* Request */}
      <p className="mt-2 text-[13px] text-white/70">
        &ldquo;{plan.request}&rdquo;
      </p>

      {/* Files affected */}
      {plan.files_affected.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-white/50">Arquivos afetados:</p>
          <ul className="mt-1 space-y-0.5">
            {plan.files_affected.map((f) => (
              <li key={f} className="text-[11px] font-mono text-white/40">
                &bull; {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {plan.steps.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-white/50">Passos:</p>
          <ol className="mt-1 space-y-0.5">
            {plan.steps.map((s, i) => (
              <li key={i} className="text-[11px] text-white/40">
                {i + 1}. {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Restart/Rebuild warnings */}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {plan.requires_restart && (
          <span className="text-amber-400/80">Requer restart do backend</span>
        )}
        {plan.requires_rebuild && (
          <span className="text-amber-400/80">Requer rebuild do frontend</span>
        )}
      </div>

      {/* Actions */}
      {status === 'pending' && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/5"
          >
            Rejeitar
          </button>
          <button
            type="button"
            onClick={handleExecute}
            className="rounded-full bg-[var(--aura-green)] px-4 py-1.5 text-[11px] font-medium text-[var(--aura-dark)] transition hover:brightness-110"
          >
            ✦ Executar
          </button>
        </div>
      )}

      {/* Executing state */}
      {status === 'executing' && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-amber-400/80">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400" />
          Executando... (pode levar até 10min)
        </div>
      )}

      {/* Completed state */}
      {status === 'completed' && (
        <div className="mt-4 text-[12px] text-emerald-400">
          <span className="font-medium">Concluído</span>
          {commitHash && <span className="ml-1 font-mono text-[11px] text-emerald-400/60"> ({commitHash})</span>}
          {resultMessage && <p className="mt-1 text-[11px] text-emerald-400/70">{resultMessage}</p>}
        </div>
      )}

      {/* Failed state */}
      {status === 'failed' && (
        <div className="mt-4 text-[12px] text-red-400">
          <span className="font-medium">Falhou</span>
          {resultMessage && <p className="mt-1 text-[11px] text-red-400/70">{resultMessage}</p>}
        </div>
      )}
    </div>
  );
}
