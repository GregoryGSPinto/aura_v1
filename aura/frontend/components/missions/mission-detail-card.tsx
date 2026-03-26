'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode,
  GitBranch,
  Loader2,
  RotateCcw,
  Target,
  XCircle,
  Zap,
} from 'lucide-react';

import type { ClaudeMission } from '@/lib/types';
import { fetchMission } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MissionScore {
  overall: number;
  code_quality: number;
  completion: number;
  test_coverage: number;
  risk: number;
}

interface MissionDetailData extends ClaudeMission {
  score?: MissionScore;
  replan_count?: number;
  blockers?: string[];
  next_steps_ai?: string[];
}

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
};

const SCORE_BG = (score: number) => {
  if (score >= 80) return 'bg-green-400';
  if (score >= 60) return 'bg-yellow-400';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-red-400';
};

export function MissionDetailCard({ missionId }: { missionId: string }) {
  const [data, setData] = useState<MissionDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMission(missionId);
      if (res.success) setData(res.data as MissionDetailData);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  const isActive = data.status === 'running' || data.status === 'queued';
  const score = data.score;

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg',
            data.status === 'done'
              ? 'bg-green-400/10'
              : data.status === 'failed'
                ? 'bg-red-400/10'
                : 'bg-blue-400/10',
          )}
        >
          {data.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : data.status === 'failed' ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          ) : (
            <Target className="h-4 w-4 text-zinc-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-200">{data.objective}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            <span>{data.project_slug}</span>
            {data.duration_s != null && (
              <>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>{data.duration_s}s</span>
              </>
            )}
            {data.retry_count > 0 && (
              <>
                <span>·</span>
                <RotateCcw className="h-3 w-3" />
                <span>{data.retry_count} retries</span>
              </>
            )}
          </div>
        </div>

        {/* Score badge */}
        {score && (
          <div className="text-center">
            <div
              className={cn(
                'text-xl font-bold',
                SCORE_COLOR(score.overall),
              )}
            >
              {score.overall}
            </div>
            <p className="text-[9px] text-zinc-600">score</p>
          </div>
        )}
      </div>

      {/* Score breakdown */}
      {score && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Código', value: score.code_quality },
            { label: 'Completude', value: score.completion },
            { label: 'Testes', value: score.test_coverage },
            { label: 'Risco', value: 100 - score.risk },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="mx-auto h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn('h-full rounded-full', SCORE_BG(s.value))}
                  style={{ width: `${s.value}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-zinc-600">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Files changed */}
      {data.files_changed && data.files_changed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {data.files_changed.slice(0, 6).map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500"
            >
              <FileCode className="h-2.5 w-2.5" />
              {f.split('/').pop()}
            </span>
          ))}
          {data.files_changed.length > 6 && (
            <span className="text-[10px] text-zinc-600">
              +{data.files_changed.length - 6}
            </span>
          )}
        </div>
      )}

      {/* Blockers */}
      {data.blockers && data.blockers.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.blockers.map((b, i) => (
            <p key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {b}
            </p>
          ))}
        </div>
      )}

      {/* Toggle details */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-400"
      >
        {showDetails ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Detalhes
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 border-t border-white/5 pt-2 text-xs">
              {data.output_parsed?.summary && (
                <div>
                  <p className="font-medium text-zinc-400">Resumo:</p>
                  <p className="whitespace-pre-wrap text-zinc-500">
                    {data.output_parsed.summary}
                  </p>
                </div>
              )}

              {data.error && (
                <div>
                  <p className="font-medium text-red-400">Erro:</p>
                  <p className="text-red-400/70">{data.error}</p>
                </div>
              )}

              {data.diff_summary && (
                <div>
                  <p className="font-medium text-zinc-400">Diff:</p>
                  <pre className="overflow-auto rounded bg-black/30 p-2 text-[10px] text-zinc-500">
                    {data.diff_summary}
                  </pre>
                </div>
              )}

              {data.next_steps_ai && data.next_steps_ai.length > 0 && (
                <div>
                  <p className="font-medium text-zinc-400">Próximos (AI):</p>
                  {data.next_steps_ai.map((s, i) => (
                    <p key={i} className="flex items-center gap-1 text-zinc-500">
                      <Zap className="h-2.5 w-2.5 text-purple-400" />
                      {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
