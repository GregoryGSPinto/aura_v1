'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, FolderOpen, GitBranch } from 'lucide-react';
import { discoverProjects, getActiveProject, setActiveProject } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';

export function ProjectSwitcher({ collapsed }: { collapsed: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const [discoverRes, activeRes] = await Promise.all([
        discoverProjects(),
        getActiveProject(),
      ]);
      if (discoverRes.success) setProjects(discoverRes.data.projects);
      if (activeRes.success && activeRes.data.project) setActive(activeRes.data.project);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleSelect = async (project: Project) => {
    try {
      const res = await setActiveProject(project.name);
      if (res.success) setActive(res.data.project);
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
          {projects.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleSelect(p)}
              className={cn(
                'flex w-full items-center gap-2 rounded-[0.95rem] px-3 py-2.5 text-left text-sm transition hover:bg-white/5',
                active?.name === p.name && 'bg-white/5 text-zinc-200',
              )}
            >
              <span className="text-base">{langIcon(p.language)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-300">{p.name}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <span>{p.language || 'unknown'}</span>
                  {p.git?.branch && (
                    <>
                      <span>·</span>
                      <span>{p.git.branch}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-600">Nenhum projeto encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
