'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, AudioLines, BrainCircuit, FolderKanban, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MemoryPanel } from '@/components/panels/memory-panel';
import { TrustPanel } from '@/components/panels/trust-panel';
import { fetchCompanionMemory, fetchCompanionOverview, fetchCompanionTrust, fetchStatus } from '@/lib/api';
import type { CompanionMemorySnapshot, CompanionOverview, CompanionTrustSnapshot, StatusPayload } from '@/lib/types';

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [overview, setOverview] = useState<CompanionOverview | null>(null);
  const [memory, setMemory] = useState<CompanionMemorySnapshot | null>(null);
  const [trust, setTrust] = useState<CompanionTrustSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [statusRes, overviewRes, memoryRes, trustRes] = await Promise.all([
          fetchStatus(),
          fetchCompanionOverview(),
          fetchCompanionMemory(),
          fetchCompanionTrust(),
        ]);
        if (!mounted) return;
        setStatus(statusRes.data);
        setOverview(overviewRes.data);
        setMemory(memoryRes.data);
        setTrust(trustRes.data);
      } catch {
        if (!mounted) return;
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const readiness = useMemo(() => {
    if (!status) return 0;
    const services = Object.values(status.services);
    const online = services.filter((value) => value === 'online').length;
    return Math.round((online / services.length) * 100);
  }, [status]);

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="aura-hero">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">Founder Cockpit</Badge>
              <Badge variant="default">Gregory Mode</Badge>
              <StatusBadge status={overview?.presence_state === 'ready' ? 'online' : 'busy'} label={status?.status ?? 'sincronizando'} />
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
                {overview?.greeting ?? 'Aura organizando o contexto do momento.'}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                {overview?.focus_summary ?? 'Um cockpit pessoal para conversa, memoria, confianca e operacao real.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/chat">
                <Button size="lg">
                  Entrar em conversa
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/trust">
                <Button variant="outline" size="lg">
                  Ver trust dashboard
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/memory">
                <Button variant="ghost" size="lg">
                  <BrainCircuit className="h-4 w-4" />
                  Revisar memoria
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {(overview?.quick_actions ?? []).map((item) => (
                <Link key={item.label} href={`/chat?prompt=${encodeURIComponent(item.prompt)}`} className="aura-chip">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="aura-panel aura-panel-strong flex flex-col justify-between gap-5 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Momento operacional</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricTile label="Readiness" value={`${readiness}%`} />
                <MetricTile label="Voz" value={overview?.voice_state ?? 'standby'} />
                <MetricTile label="Prioridades" value={String(overview?.priorities.length ?? 0)} />
                <MetricTile label="Confianca" value={String(overview?.trust_signals.length ?? 0)} />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="aura-orb-sm">
                  <Sparkles className="h-4 w-4 text-[var(--accent-cyan)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Presenca ativa</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {overview?.behavior_mode ?? 'founder-operational'} · {status?.model ?? 'Aura'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="aura-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Agora</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Prioridades e retomada</h2>
            </div>
            <Badge variant="gold">Uso diario</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {(overview?.priorities ?? []).map((priority) => (
              <div key={priority.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{priority.label}</p>
                  <Badge variant={priority.level === 'urgent' ? 'gold' : 'default'}>{priority.level}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{priority.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="aura-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Projetos em foco</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Retomar de onde paramos</h2>
            </div>
            <Link href="/projects" className="text-sm text-[var(--accent-cyan)] hover:text-[var(--text-primary)]">
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {(overview?.recent_projects ?? []).length ? (
              overview?.recent_projects.map((project) => (
                <div key={project.id ?? project.name} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <FolderKanban className="h-4 w-4 text-[var(--accent-cyan)]" />
                    {project.name}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{project.description || project.path}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sem projetos recentes disponiveis.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="aura-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Companion signals</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Memoria ativa e confirmacoes</h2>
            </div>
            <Badge variant="cyan">{overview?.memory_signals.length ?? 0}</Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(overview?.memory_signals ?? []).map((item) => (
              <div key={item.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-subtle)]">{item.kind}</p>
                <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.content}</p>
              </div>
            ))}
            {(overview?.pending_actions ?? []).map((action) => (
              <div key={action.command} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <Workflow className="h-4 w-4 text-[var(--accent-cyan)]" />
                  {action.command}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{action.preview}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="aura-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Presence system</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Voz, confianca e disponibilidade</h2>
            </div>
            <AudioLines className="h-4 w-4 text-[var(--accent-cyan)]" />
          </div>
          <div className="mt-5 space-y-3">
            {(overview?.trust_signals ?? []).map((signal) => (
              <div key={signal.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{signal.label}</p>
                  <Badge variant={signal.level === 'warning' ? 'gold' : 'default'}>{signal.level}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MemoryPanel snapshot={memory} />
      <TrustPanel snapshot={trust} />
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-subtle)]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
