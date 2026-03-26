'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Shield, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ApprovalRequest {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  risk_level: string;
  preview: string;
  side_effects: string[];
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-400/10 border-green-400/20',
  moderate: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  elevated: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
};

export function ApprovalDialog() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ApprovalRequest>).detail;
      if (detail) setRequests((prev) => [...prev, detail]);
    };
    window.addEventListener('aura:tool-approval', handler);
    return () => window.removeEventListener('aura:tool-approval', handler);
  }, []);

  const handleAction = useCallback(
    (id: string, approved: boolean) => {
      window.dispatchEvent(
        new CustomEvent('aura:tool-approval-response', {
          detail: { id, approved },
        }),
      );
      setRequests((prev) => prev.filter((r) => r.id !== id));
    },
    [],
  );

  const current = requests[0];

  return (
    <AnimatePresence>
      {current && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => handleAction(current.id, false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Aprovação Necessária
                </h3>
                <p className="text-xs text-zinc-500">
                  Uma ação requer sua confirmação
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Ferramenta:
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-zinc-200">
                  {current.tool}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Risco:
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                    RISK_COLORS[current.risk_level] || RISK_COLORS.moderate,
                  )}
                >
                  {current.risk_level}
                </span>
              </div>

              {current.preview && (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-xs text-zinc-400">{current.preview}</p>
                </div>
              )}

              {current.side_effects?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400">
                    Efeitos colaterais:
                  </p>
                  {current.side_effects.map((effect, i) => (
                    <p
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-zinc-500"
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      {effect}
                    </p>
                  ))}
                </div>
              )}

              {Object.keys(current.params).length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
                    Ver parâmetros
                  </summary>
                  <pre className="mt-1 overflow-auto rounded bg-black/30 p-2 text-[10px] text-zinc-500">
                    {JSON.stringify(current.params, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleAction(current.id, false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <XCircle className="h-4 w-4" />
                Rejeitar
              </button>
              <button
                type="button"
                onClick={() => handleAction(current.id, true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
