'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';

import type { ClaudeMission } from '@/lib/types';
import { executeMission, cancelMission, retryMission, fetchMission } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Loader2 }> = {
  queued: { label: 'Na fila', color: 'text-zinc-400', bg: 'border-zinc-500/20 bg-zinc-500/5', icon: Terminal },
  running: { label: 'Executando...', color: 'text-blue-400', bg: 'border-blue-500/20 bg-blue-500/5', icon: Loader2 },
  blocked: { label: 'Bloqueada', color: 'text-yellow-400', bg: 'border-yellow-500/20 bg-yellow-500/5', icon: XCircle },
  needs_approval: { label: 'Aprovacao', color: 'text-amber-400', bg: 'border-amber-500/20 bg-amber-500/5', icon: Terminal },
  done: { label: 'Concluida', color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/5', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'text-red-400', bg: 'border-red-500/20 bg-red-500/5', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'text-zinc-500', bg: 'border-zinc-600/20 bg-zinc-600/5', icon: X },
};

export function MissionInlineCard({
  missionId,
  objective,
  initialStatus = 'queued',
}: {
  missionId: string;
  objective: string;
  initialStatus?: string;
}) {
  const [mission, setMission] = useState<ClaudeMission | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  // Poll for status while running/queued
  useEffect(() => {
    if (status !== 'running' && status !== 'queued') return;

    const poll = setInterval(async () => {
      try {
        const res = await fetchMission(missionId);
        if (res.success) {
          setMission(res.data);
          setStatus(res.data.status);
        }
      } catch {
        /* silent */
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [missionId, status]);

  // Listen for WebSocket mission.progress events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.mission_id === missionId) {
        setStatus(detail.status);
      }
    };
    window.addEventListener('aura:mission-progress', handler);
    return () => window.removeEventListener('aura:mission-progress', handler);
  }, [missionId]);

  const handleExecute = useCallback(async () => {
    setActing(true);
    try {
      const res = await executeMission(missionId);
      if (res.success) {
        setMission(res.data);
        setStatus(res.data.status);
      }
    } catch { /* silent */ } finally {
      setActing(false);
    }
  }, [missionId]);

  const handleCancel = useCallback(async () => {
    setActing(true);
    try {
      await cancelMission(missionId);
      setStatus('cancelled');
    } catch { /* silent */ } finally {
      setActing(false);
    }
  }, [missionId]);

  const handleRetry = useCallback(async () => {
    setActing(true);
    try {
      const res = await retryMission(missionId);
      if (res.success) {
        setMission(res.data);
        setStatus(res.data.status);
      }
    } catch { /* silent */ } finally {
      setActing(false);
    }
  }, [missionId]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('my-2 rounded-lg border p-3', cfg.bg)}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            cfg.color,
            status === 'running' && 'animate-spin',
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-zinc-200">
            {objective}
          </p>
          <p className={cn('text-[10px] font-medium', cfg.color)}>
            {cfg.label}
            {status === 'running' && (
              <span className="ml-1.5 inline-flex gap-0.5">
                <span className="typing-dot h-1 w-1 rounded-full bg-blue-400" />
                <span className="typing-dot h-1 w-1 rounded-full bg-blue-400" />
                <span className="typing-dot h-1 w-1 rounded-full bg-blue-400" />
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {status === 'queued' && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={acting}
              className="flex items-center gap-1 rounded-md bg-emerald-600/20 px-2 py-1 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-40"
            >
              {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Executar
            </button>
          )}
          {(status === 'running' || status === 'queued') && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={acting}
              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-red-400 disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {status === 'failed' && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={acting}
              className="flex items-center gap-1 rounded-md bg-amber-600/20 px-2 py-1 text-[10px] font-medium text-amber-300 transition hover:bg-amber-600/30 disabled:opacity-40"
            >
              {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Retry
            </button>
          )}

          {/* Expand toggle */}
          {mission && (status === 'done' || status === 'failed') && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && mission && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2 text-xs">
          {/* Duration */}
          {mission.duration_s != null && (
            <p className="text-zinc-500">Duracao: {mission.duration_s}s</p>
          )}

          {/* Error */}
          {mission.error && (
            <p className="text-red-400">Erro: {mission.error}</p>
          )}

          {/* Summary */}
          {mission.output_parsed?.summary && (
            <div>
              <p className="font-medium text-zinc-400">Resumo:</p>
              <p className="whitespace-pre-wrap text-zinc-500">{mission.output_parsed.summary}</p>
            </div>
          )}

          {/* Files changed */}
          {mission.files_changed && mission.files_changed.length > 0 && (
            <div>
              <p className="font-medium text-zinc-400">Arquivos alterados:</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {mission.files_changed.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500"
                  >
                    <FileCode className="h-2.5 w-2.5" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {mission.output_parsed?.next_steps && mission.output_parsed.next_steps.length > 0 && (
            <div>
              <p className="font-medium text-zinc-400">Proximos passos:</p>
              <ul className="mt-0.5 space-y-0.5 text-zinc-500">
                {mission.output_parsed.next_steps.map((step, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="text-zinc-600">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diff summary (truncated) */}
          {mission.diff_summary && (
            <details className="group">
              <summary className="cursor-pointer font-medium text-zinc-400 hover:text-zinc-300">
                Diff
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-500">
                {mission.diff_summary.slice(0, 3000)}
                {mission.diff_summary.length > 3000 && '\n... (truncated)'}
              </pre>
            </details>
          )}
        </div>
      )}
    </motion.div>
  );
}
