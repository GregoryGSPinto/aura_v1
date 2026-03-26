'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, FolderOpen, GitBranch } from 'lucide-react';
import { discoverProjects, getActiveProject, setActiveProject, fetchMemoryProjects } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project, MemoryProject } from '@/lib/types';

const STATUS_BADGE: Record<string, { dot: string; label: string }> = {
  active: { dot: 'bg-green-400', label: 'ativo' },
  paused: { dot: 'bg-yellow-400', label: 'pausado' },
  completed: { dot: 'bg-blue-400', label: 'concluido' },
  archived: { dot: 'bg-zinc-500', label: 'arquivado' },
};

interface MergedProject extends Project {
  memoryStatus?: string;
  deployUrl?: string;
  memorySlug?: string;
  stack?: string[];
}

export function ProjectSwitcher({ collapsed }: { collapsed: boolean }) {
  const [projects, setProjects] = useState<MergedProject[]>([]);
  const [active, setActive] = useState<MergedProject | null>(null);
  const [open, setOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const [discoverRes, activeRes, memoryRes] = await Promise.all([
        discoverProjects(),
        getActiveProject(),
        fetchMemoryProjects().catch(() => ({ success: false, data: [] as MemoryProject[] })),
      ]);

      // Build memory lookup
      const memLookup = new Map<string, MemoryProject>();
      if (memoryRes.success && Array.isArray(memoryRes.data)) {
        for (const mp of memoryRes.data) {
          memLookup.set(mp.slug, mp);
          // Also match by name (lowercase)
          memLookup.set(mp.name.toLowerCase(), mp);
        }
      }

      // Merge discovered projects with memory data
      const discovered: MergedProject[] = discoverRes.success
        ? discoverRes.data.projects.map((p: Project) => {
            const mem = memLookup.get(p.name.toLowerCase()) || memLookup.get(p.name);
            const merged: MergedProject = { ...p };
            if (mem) {
              merged.memoryStatus = mem.status;
              merged.deployUrl = mem.deploy_url ?? undefined;
              merged.memorySlug = mem.slug;
              merged.stack = mem.stack ?? undefined;
              memLookup.delete(mem.slug);
              memLookup.delete(mem.name.toLowerCase());
            }
            return merged;
          })
        : [];

      // Add memory-only projects that weren't discovered on filesystem
      for (const [key, mem] of memLookup) {
        if (key !== mem.slug) continue; // Skip name-based duplicate keys
        discovered.push({
          id: mem.slug,
          name: mem.name,
          path: mem.directory ?? '',
          description: mem.description ?? undefined,
          status: mem.status === 'active' ? 'active' : 'archived',
          memoryStatus: mem.status,
          deployUrl: mem.deploy_url ?? undefined,
          memorySlug: mem.slug,
          stack: mem.stack ?? undefined,
        });
      }

      setProjects(discovered);
      if (activeRes.success && activeRes.data.project) {
        const activeMem = memLookup.get(activeRes.data.project.name?.toLowerCase());
        setActive({
          ...activeRes.data.project,
          memoryStatus: activeMem?.status,
          memorySlug: activeMem?.slug,
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleSelect = async (project: MergedProject) => {
    try {
      const res = await setActiveProject(project.name);
      if (res.success) setActive({ ...res.data.project, memoryStatus: project.memoryStatus, memorySlug: project.memorySlug });
    } catch { /* silent */ }
    setOpen(false);
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center p-2">
        <FolderOpen className="h-4 w-4 text-zinc-500" />
      </div>
    );
  }

  const langIcon = (lang?: string) => {
    if (!lang) return '📁';
    const l = lang.toLowerCase();
    if (l.includes('python')) return '🐍';
    if (l.includes('typescript') || l.includes('javascript')) return '📘';
    if (l.includes('rust')) return '🦀';
    if (l.includes('go')) return '🔷';
    return '📁';
  };

  return (
    <div className="relative border-b border-white/5 px-3 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-[1rem] px-2.5 py-2 text-sm transition hover:bg-white/5"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="truncate font-medium text-zinc-200">
          {active?.name || 'Selecionar projeto'}
        </span>
        {active?.memoryStatus && (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_BADGE[active.memoryStatus]?.dot || 'bg-zinc-500')} />
        )}
        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {active?.git && (
        <div className="mt-1 flex items-center gap-1.5 px-2 text-[11px] text-zinc-500">
          <GitBranch className="h-3 w-3" />
          <span>{active.git.branch || 'main'}</span>
          <span>·</span>
          <span className={active.git.uncommitted_changes > 0 ? 'text-yellow-500' : 'text-green-500'}>
            {active.git.uncommitted_changes > 0 ? `${active.git.uncommitted_changes} changes` : 'clean'}
          </span>
        </div>
      )}

      {open && (
        <div className="app-popover absolute left-2 right-2 top-full z-50 mt-1.5 rounded-[1.1rem] py-1.5">
          {projects.map((p) => {
            const badge = STATUS_BADGE[p.memoryStatus || 'active'];
            return (
              <button
                key={p.memorySlug || p.name}
                type="button"
                onClick={() => handleSelect(p)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[0.95rem] px-3 py-2.5 text-left text-sm transition hover:bg-white/5',
                  active?.name === p.name && 'bg-white/5 text-zinc-200',
                )}
              >
                <span className="text-base">{langIcon(p.language)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium text-zinc-300">{p.name}</p>
                    {badge && (
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', badge.dot)} title={badge.label} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <span>{p.language || (p.stack?.length ? p.stack[0] : 'unknown')}</span>
                    {p.git?.branch && (
                      <>
                        <span>·</span>
                        <span>{p.git.branch}</span>
                      </>
                    )}
                    {p.deployUrl && (
                      <>
                        <span>·</span>
                        <span className="text-blue-500">deployed</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-600">Nenhum projeto encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
