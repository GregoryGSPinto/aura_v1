'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, AudioLines, Compass, FolderKanban, ShieldCheck, Sparkles, Telescope, Workflow } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchProjects, fetchStatus } from '@/lib/api';
import { auraMoodCopy, auraQuickPrompts } from '@/lib/design-system/tokens';
import type { Project, StatusPayload } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils';

function resolveGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return auraMoodCopy.morning;
  if (hour < 18) return auraMoodCopy.afternoon;
  return auraMoodCopy.evening;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [statusRes, projectsRes] = await Promise.all([fetchStatus(), fetchProjects()]);
        if (!mounted) return;
        setStatus(statusRes.data);
        setProjects(projectsRes.data.projects.slice(0, 4));
        setLoadedAt(new Date().toISOString());
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
              <Badge variant="cyan">Aura Presence</Badge>
              <Badge variant="default">Local-first</Badge>
              <StatusBadge status={status?.services.api === 'online' ? 'online' : 'busy'} label={status?.status ?? 'sincronizando'} />
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
                Uma presenca operacional pessoal, calma e pronta para agir.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                {resolveGreeting()} Aura concentra conversa, contexto, memoria e acao em uma experiencia refinada para uso diario.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/chat">
                <Button size="lg">
                  Entrar em conversa
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/swarm">
                <Button variant="outline" size="lg">
                  Ver rotinas
                  <Workflow className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="lg">
                <AudioLines className="h-4 w-4" />
                Ativar voz
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {auraQuickPrompts.map((item) => (
                <Link key={item} href={`/chat?prompt=${encodeURIComponent(item)}`} className="aura-chip">
                  {item}
                </Link>
              ))}
            </div>
          </div>

          <div className="aura-panel aura-panel-strong flex flex-col justify-between gap-5 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Momento operacional</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricTile label="Readiness" value={`${readiness}%`} />
                <MetricTile label="Projetos" value={String(projects.length)} />
                <MetricTile label="Jobs ativos" value={String(status?.jobs?.running ?? 0)} />
                <MetricTile label="Modelo" value={status?.model?.split(':')[0] ?? 'Aura'} />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="aura-orb-sm">
                  <Sparkles className="h-4 w-4 text-[var(--accent-cyan)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">A Aura esta presente</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {loadedAt ? `Sincronizada ${getRelativeTime(loadedAt)}` : 'Aguardando telemetria'}
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
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Foco do dia</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Superficies principais</h2>
            </div>
            <Badge variant="gold">Uso diario</Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <SurfaceCard href="/chat" icon={Compass} title="Conversa viva" description="Abrir uma sessao com contexto, sugestoes e memoria ativa." />
            <SurfaceCard href="/projects" icon={FolderKanban} title="Projetos recentes" description="Retomar workspaces, contexto de execucao e proximas acoes." />
            <SurfaceCard href="/system" icon={ShieldCheck} title="Confianca operacional" description="Ver readiness, auth, runtime e sinais de degradacao." />
            <SurfaceCard href="/remote" icon={Telescope} title="Ferramentas acionaveis" description="Acessar superficies reais com controle e rastreabilidade." />
          </div>
        </div>

        <div className="aura-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Projetos em foco</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Contexto recente</h2>
            </div>
            <Link href="/projects" className="text-sm text-[var(--accent-cyan)] hover:text-[var(--text-primary)]">
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <div key={project.id ?? project.name} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{project.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{project.description || project.path}</p>
                    </div>
                    <Badge variant="default">{project.status ?? 'active'}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sem projetos recentes disponiveis.</p>
            )}
          </div>
        </div>
      </section>
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

function SurfaceCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Compass;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 transition hover:border-[var(--border-strong)] hover:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <div className="rounded-[16px] border border-white/8 bg-white/[0.04] p-3">
          <Icon className="h-5 w-5 text-[var(--accent-cyan)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        </div>
      </div>
    </Link>
  );
}
