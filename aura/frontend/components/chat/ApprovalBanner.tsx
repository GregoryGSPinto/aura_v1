'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getApprovals, handleApproval } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PendingApproval {
  id: string;
  tool_name: string;
  description: string;
  requested_at: string;
}

export function ApprovalBanner() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await getApprovals();
      setApprovals(data.pending || []);
    } catch {
      // silently fail
    }
  }, []);

  // Poll for approvals every 5 seconds
  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  // Also listen for tool.needs_approval WebSocket events
  useEffect(() => {
    const handler = () => { fetchApprovals(); };
    window.addEventListener('aura:tool-approval', handler);
    return () => window.removeEventListener('aura:tool-approval', handler);
  }, [fetchApprovals]);

  const onApprove = async (approvalId: string) => {
    setLoading(approvalId);
    try {
      await handleApproval(approvalId, true);
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } finally {
      setLoading(null);
    }
  };

  const onReject = async (approvalId: string) => {
    setLoading(approvalId);
    try {
      await handleApproval(approvalId, false);
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } finally {
      setLoading(null);
    }
  };

  if (!approvals.length) return null;

  return (
    <div className="shrink-0 mx-4 mt-2 rounded-xl border border-[rgba(234,179,8,0.2)] bg-[rgba(234,179,8,0.08)] animate-fade-in-up">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs text-amber-400 transition hover:bg-amber-500/10 rounded-xl"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          {approvals.length} {approvals.length === 1 ? 'acao aguardando' : 'acoes aguardando'} aprovacao
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-2 px-4 pb-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-300">
                  {approval.tool_name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                  {approval.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onApprove(approval.id)}
                  disabled={loading === approval.id}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition',
                    'bg-[var(--aura-green)] text-[var(--aura-dark)] hover:brightness-110 rounded-full',
                    loading === approval.id && 'opacity-50',
                  )}
                >
                  <Check className="h-3 w-3" />
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => onReject(approval.id)}
                  disabled={loading === approval.id}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition',
                    'bg-transparent border border-white/20 text-white/60 hover:bg-white/5 rounded-full',
                    loading === approval.id && 'opacity-50',
                  )}
                >
                  <X className="h-3 w-3" />
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
