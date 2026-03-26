'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  Shield,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  tool: string;
  risk_level: string;
  status: 'approved' | 'rejected' | 'auto_approved' | 'pending';
  user: string;
  timestamp: string;
  details?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  approved: { icon: CheckCircle2, color: 'text-green-400', label: 'Aprovado' },
  rejected: { icon: XCircle, color: 'text-red-400', label: 'Rejeitado' },
  auto_approved: { icon: Shield, color: 'text-blue-400', label: 'Auto' },
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pendente' },
};

export function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(`${base}/api/v1/safety/audit?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <FileText className="h-4 w-4 text-amber-400" />
          Auditoria
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {entries.length === 0 && (
          <p className="py-4 text-center text-xs text-zinc-600">
            Nenhum registro de auditoria
          </p>
        )}
        {entries.map((entry) => {
          const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          return (
            <div
              key={entry.id}
              className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
                <span className="flex-1 truncate text-xs font-medium text-zinc-300">
                  {entry.tool}
                </span>
                <span className={cn('text-[10px]', cfg.color)}>{cfg.label}</span>
              </div>
              {entry.details && (
                <p className="mt-1 text-[10px] text-zinc-500">{entry.details}</p>
              )}
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {new Date(entry.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
