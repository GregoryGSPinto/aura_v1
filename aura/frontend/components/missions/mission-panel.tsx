'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';

import type { ClaudeMission } from '@/lib/types';
import { createMission, executeMission, fetchMissions, cancelMission, retryMission } from '@/lib/api';
import { cn } from '@/lib/utils';

type MissionStatus = ClaudeMission['status'];

const STATUS_CONFIG: Record<MissionStatus, { label: string; color: string; icon: typeof Clock }> = {
  queued: { label: 'Na fila', color: 'text-zinc-400', icon: Clock },
  running: { label: 'Executando', color: 'text-blue-400', icon: Loader2 },
  blocked: { label: 'Bloqueada', color: 'text-yellow-400', icon: XCircle },
  needs_approval: { label: 'Aprovacao', color: 'text-amber-400', icon: Clock },
  done: { label: 'Concluida', color: 'text-emerald-400', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'text-red-400', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'text-zinc-500', icon: X },
};

export function MissionPanel({ projectSlug }: { projectSlug?: string }) {
  const [missions, setMissions] = useState<ClaudeMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newObjective, setNewObjective] = useState('');

  const loadMissions = useCallback(async () => {
    try {
      const res = await fetchMissions({ project_slug: projectSlug, limit: 20 });
      if (res.success) setMissions(res.data);
    } catch {
      /* silent */
    }
  }, [projectSlug]);

  useEffect(() => {
    loadMissions();
    const interval = setInterval(loadMissions, 10000);
    return () => clearInterval(interval);
  }, [loadMissions]);

  const handleCreate = useCallback(async () => {
    if (!newObjective.trim() || !projectSlug) return;
    setCreating(true);
    try {
      const res = await createMission({
        objective: newObjective.trim(),
        project_slug: projectSlug,
      });
      if (res.success) {
        setNewObjective('');
        // Auto-execute
        await executeMission(res.data.id);
        await loadMissions();
      }
    } catch {
      /* silent */
    } finally {
      setCreating(false);
    }
  }, [newObjective, projectSlug, loadMissions]);

  const handleCancel = useCallback(async (id: string) => {
    try {
      await cancelMission(id);
      await loadMissions();
    } catch { /* silent */ }
  }, [loadMissions]);

  const handleRetry = useCallback(async (id: string) => {
    try {
      await retryMission(id);
      await loadMissions();
    } catch { /* silent */ }
  }, [loadMissions]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Terminal className="h-4 w-4 text-purple-400" />
          Claude Missions
        </h3>
        <button
          type="button"
          onClick={loadMissions}
          className="rounded p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Create mission */}
      {projectSlug && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nova missao..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500/50"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newObjective.trim()}
            className="flex items-center gap-1 rounded-lg bg-purple-600/20 px-3 py-1.5 text-xs font-medium text-purple-300 transition hover:bg-purple-600/30 disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Criar
          </button>
        </div>
      )}

      {/* Mission list */}
      <div className="flex flex-col gap-1.5">
        {missions.length === 0 && (
          <p className="py-4 text-center text-xs text-zinc-600">Nenhuma missao ainda</p>
        )}
        <AnimatePresence mode="popLayout">
          {missions.map((mission) => {
            const cfg = STATUS_CONFIG[mission.status];
            const Icon = cfg.icon;
            const isExpanded = expanded === mission.id;

            return (
              <motion.div
                key={mission.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-lg border border-white/5 bg-white/[0.02]"
              >
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : mission.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
                  )}
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      cfg.color,
                      mission.status === 'running' && 'animate-spin',
                    )}
                  />
                  <span className="flex-1 truncate text-xs text-zinc-300">
                    {mission.objective}
                  </span>
                  <span className={cn('text-[10px] font-medium', cfg.color)}>
                    {cfg.label}
                  </span>
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 px-3 py-2 text-xs">
                        {/* Duration */}
                        {mission.duration_s != null && (
                          <p className="text-zinc-500">
                            Duracao: {mission.duration_s}s
                          </p>
                        )}

                        {/* Error */}
                        {mission.error && (
                          <p className="mt-1 text-red-400">
                            Erro: {mission.error}
                          </p>
                        )}

                        {/* Output summary */}
                        {mission.output_parsed?.summary && (
                          <div className="mt-1.5">
                            <p className="font-medium text-zinc-400">Resumo:</p>
                            <p className="whitespace-pre-wrap text-zinc-500">
                              {mission.output_parsed.summary}
                            </p>
                          </div>
                        )}

                        {/* Files changed */}
                        {mission.files_changed && mission.files_changed.length > 0 && (
                          <div className="mt-1.5">
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

                        {/* Actions */}
                        <div className="mt-2 flex gap-2">
                          {mission.status === 'failed' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRetry(mission.id); }}
                              className="flex items-center gap-1 rounded bg-amber-600/20 px-2 py-1 text-[10px] text-amber-300 transition hover:bg-amber-600/30"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              Retry
                            </button>
                          )}
                          {(mission.status === 'running' || mission.status === 'queued') && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleCancel(mission.id); }}
                              className="flex items-center gap-1 rounded bg-red-600/20 px-2 py-1 text-[10px] text-red-300 transition hover:bg-red-600/30"
                            >
                              <X className="h-2.5 w-2.5" />
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
