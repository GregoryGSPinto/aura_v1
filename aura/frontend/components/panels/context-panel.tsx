"use client";

import { BrainCircuit, Clock3, FolderKanban, Radio, Shield, Sparkles, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { fetchCompanionOverview, fetchProjects, fetchStatus } from "@/lib/api";
import type { CompanionOverview, Project, StatusPayload } from "@/lib/types";
import { getRelativeTime } from "@/lib/utils";

export function ContextPanel({
  pageMeta,
}: {
  pageMeta: { eyebrow: string; title: string; description: string; accent: string };
}) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [overview, setOverview] = useState<CompanionOverview | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [statusRes, projectsRes, overviewRes] = await Promise.all([fetchStatus(), fetchProjects(), fetchCompanionOverview()]);
        if (!mounted) return;
        setStatus(statusRes.data);
        setProjects(projectsRes.data.projects.slice(0, 3));
        setOverview(overviewRes.data);
        setTimestamp(new Date().toISOString());
      } catch {
        if (!mounted) return;
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const readiness = useMemo(() => {
    if (!status) return 0;
    const services = Object.values(status.services);
    const online = services.filter((value) => value === "online").length;
    return Math.round((online / services.length) * 100);
  }, [status]);

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-3 flex flex-col gap-4">
        <section className="rounded-xl border border-white/5 bg-zinc-900 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Contexto atual</p>
              <h2 className="mt-2 text-base font-semibold">{pageMeta.title}</h2>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-400">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">{pageMeta.description}</p>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Memoria ativa</p>
            <Badge variant="cyan">{overview?.memory_signals.length ?? 0}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {(overview?.memory_signals ?? []).slice(0, 2).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BrainCircuit className="h-4 w-4 text-blue-400" />
                  <span className="truncate">{item.title}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">{item.content}</p>
              </div>
            ))}
            {!overview?.memory_signals.length && <p className="text-sm text-zinc-500">A Aura mostrara memorias relevantes aqui.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Presenca Aura</p>
            <StatusBadge status={status?.services.api === "online" ? "online" : "busy"} label={status?.status ?? "sincronizando"} />
          </div>
          <div className="mt-4 space-y-2">
            <ContextRow icon={Shield} label="Readiness" value={`${readiness}%`} />
            <ContextRow icon={Radio} label="Auth" value={status?.auth_mode ?? "local"} />
            <ContextRow icon={Waves} label="Modelo" value={status?.model ?? "aguardando"} />
            <ContextRow icon={Clock3} label="Atualizado" value={timestamp ? getRelativeTime(timestamp) : "agora"} />
          </div>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Projetos recentes</p>
            <Badge variant="cyan">{projects.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <div key={project.id ?? project.name} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FolderKanban className="h-4 w-4 text-blue-400" />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                    {project.description || project.path}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Sem contexto de projetos carregado.</p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Icon className="h-4 w-4 text-blue-400" />
        <span>{label}</span>
      </div>
      <span className="max-w-[10rem] truncate text-sm text-zinc-500">{value}</span>
    </div>
  );
}
