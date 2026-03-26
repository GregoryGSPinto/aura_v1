'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  GitCommit,
  Loader2,
  RotateCcw,
  Sun,
  Target,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface BriefingData {
  greeting: string;
  date: string;
  summary: string;
  projects: {
    name: string;
    status: string;
    recent_commits: number;
    pending_tasks: number;
    health: 'good' | 'warning' | 'critical';
  }[];
  priorities: {
    label: string;
    level: 'urgent' | 'important' | 'normal';
    source: string;
  }[];
  suggestions: {
    text: string;
    action: string;
    category: string;
  }[];
  stats: {
    commits_today: number;
    missions_completed: number;
    uptime_hours: number;
  };
}

const HEALTH_COLOR: Record<string, string> = {
  good: 'bg-green-400',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400',
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-400 bg-red-400/10',
  important: 'text-amber-400 bg-amber-400/10',
  normal: 'text-blue-400 bg-blue-400/10',
};

export function DailyBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('projects');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(`${base}/api/v1/briefing/daily`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
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

  const toggle = (section: string) =>
    setExpandedSection((prev) => (prev === section ? null : section));

  const sendSuggestion = (text: string) => {
    window.dispatchEvent(new CustomEvent('aura:suggestion', { detail: text }));
  };

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
        <Sun className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">Briefing indisponível</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{data.greeting}</h2>
            <p className="text-[11px] text-zinc-500">{data.date}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs leading-relaxed text-zinc-400">{data.summary}</p>

      {/* Stats bar */}
      <div className="flex gap-3">
        {[
          { icon: GitCommit, label: 'Commits', value: data.stats.commits_today },
          { icon: Target, label: 'Missões', value: data.stats.missions_completed },
          { icon: Clock, label: 'Uptime', value: `${data.stats.uptime_hours}h` },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-center"
            >
              <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200">{stat.value}</p>
              <p className="text-[10px] text-zinc-600">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Projects section */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => toggle('projects')}
          className="flex w-full items-center gap-2 p-3 text-left"
        >
          {expandedSection === 'projects' ? (
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-500" />
          )}
          <Calendar className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-medium text-zinc-300">
            Projetos ({data.projects.length})
          </span>
        </button>
        <AnimatePresence>
          {expandedSection === 'projects' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 border-t border-white/5 px-3 pb-3 pt-2">
                {data.projects.map((proj) => (
                  <div
                    key={proj.name}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        HEALTH_COLOR[proj.health] || 'bg-zinc-500',
                      )}
                    />
                    <span className="flex-1 truncate font-medium text-zinc-300">
                      {proj.name}
                    </span>
                    <span className="text-zinc-500">
                      {proj.recent_commits}c · {proj.pending_tasks}t
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Priorities */}
      {data.priorities.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            Prioridades
          </p>
          <div className="space-y-1">
            {data.priorities.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    PRIORITY_COLOR[p.level] || PRIORITY_COLOR.normal,
                  )}
                >
                  {p.level}
                </span>
                <span className="flex-1 truncate text-zinc-300">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            Sugestões
          </p>
          <div className="space-y-1">
            {data.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendSuggestion(s.action)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <Zap className="h-3 w-3 shrink-0 text-purple-400" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
