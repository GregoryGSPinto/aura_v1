'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  FileCode,
  GitCommit,
  Layers,
  Loader2,
  RotateCcw,
  Target,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface WorkspaceDashboard {
  project: {
    name: string;
    slug: string;
    status: string;
    stack: string[];
    deploy_url?: string;
    health: string;
  };
  recent_commits: {
    hash: string;
    message: string;
    author: string;
    date: string;
  }[];
  activity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
  active_missions: {
    id: string;
    objective: string;
    status: string;
  }[];
  next_steps: string[];
  notes: string;
}

const HEALTH_DOT: Record<string, string> = {
  good: 'bg-green-400',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400',
  unknown: 'bg-zinc-500',
};

export function WorkspaceDashboardView({ slug }: { slug: string }) {
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(
        `${base}/api/v1/workspace/projects/${slug}/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-8 text-center">
        <Layers className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">Workspace não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-bold text-zinc-100">
              {data.project.name}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  HEALTH_DOT[data.project.health] || HEALTH_DOT.unknown,
                )}
              />
              <span>{data.project.status}</span>
              {data.project.stack?.length > 0 && (
                <>
                  <span>·</span>
                  <span>{data.project.stack.slice(0, 3).join(', ')}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <RotateCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Active missions */}
      {data.active_missions.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <Target className="h-3 w-3" />
            Missões Ativas
          </h3>
          <div className="space-y-1">
            {data.active_missions.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
              >
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                <span className="flex-1 truncate text-zinc-300">
                  {m.objective}
                </span>
                <span className="text-[10px] text-blue-400">{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent commits */}
      {data.recent_commits.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <GitCommit className="h-3 w-3" />
            Commits Recentes
          </h3>
          <div className="space-y-1">
            {data.recent_commits.slice(0, 5).map((c) => (
              <div
                key={c.hash}
                className="flex items-center gap-2 text-xs"
              >
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                  {c.hash.slice(0, 7)}
                </span>
                <span className="flex-1 truncate text-zinc-400">
                  {c.message}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-600">
                  {c.author}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      {data.activity.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <Activity className="h-3 w-3" />
            Atividade Recente
          </h3>
          <div className="space-y-1.5">
            {data.activity.slice(0, 8).map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[11px]"
              >
                <ChevronRight className="h-2.5 w-2.5 text-zinc-600" />
                <span className="flex-1 text-zinc-400">{a.description}</span>
                <span className="shrink-0 text-zinc-600">
                  {new Date(a.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {data.next_steps?.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <CheckCircle2 className="h-3 w-3" />
            Próximos Passos
          </h3>
          <div className="space-y-1">
            {data.next_steps.map((step, i) => (
              <p key={i} className="text-xs text-zinc-400">
                {i + 1}. {step}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <FileCode className="h-3 w-3" />
            Notas
          </h3>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
            {data.notes}
          </p>
        </div>
      )}
    </div>
  );
}
