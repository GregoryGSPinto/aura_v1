'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCode,
  GitCommit,
  Layers,
  Play,
  Send,
  Settings2,
  Terminal,
} from 'lucide-react';

import { HealthPanel } from '@/components/health/health-panel';
import { MissionPanel } from '@/components/missions/mission-panel';
import { useAdaptiveEdgeSidebar } from '@/hooks/use-adaptive-edge-sidebar';
import { useHealth } from '@/hooks/use-health';
import { useMemory } from '@/hooks/use-memory';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { useEditorStore } from '@/lib/editor-store';
import { cn } from '@/lib/utils';

function ActiveProjectInfo() {
  const { projects, preferences } = useMemory();
  // Find the active project from memory (first 'active' one or first overall)
  const activeProject = projects.find((p) => p.status === 'active') || projects[0];

  // Summarize preferences into a compact string
  const prefSummary = preferences
    .filter((p) => ['tools', 'dev', 'style'].includes(p.category))
    .map((p) => p.value)
    .slice(0, 6);

  return (
    <>
      {/* Active project info */}
      {activeProject && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
            Projeto Ativo
          </p>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              <span className="font-medium text-zinc-200">{activeProject.name}</span>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                activeProject.status === 'active' ? 'bg-green-400' : 'bg-zinc-500',
              )} />
            </div>
            {activeProject.stack && activeProject.stack.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(activeProject.stack as string[]).slice(0, 4).map((s) => (
                  <span key={s} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{s}</span>
                ))}
              </div>
            )}
            {activeProject.deploy_url && (
              <a
                href={activeProject.deploy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Deploy
              </a>
            )}
          </div>
        </div>
      )}

      {/* Preferences summary */}
      {prefSummary.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-600">
            <Settings2 className="h-3 w-3" />
            Preferencias
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {prefSummary.join(' · ')}
          </p>
        </div>
      )}
    </>
  );
}

function ChatContext() {
  const suggestions = [
    'Status dos projetos',
    'Roda os testes',
    'Deploy pro Vercel',
    'Git status',
    'Como tá a memória?',
  ];

  const sendSuggestion = (text: string) => {
    window.dispatchEvent(new CustomEvent('aura:suggestion', { detail: text }));
  };

  return (
    <div className="space-y-4">
      <ActiveProjectInfo />
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Sugestões rápidas
        </p>
        <div className="space-y-0.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendSuggestion(s)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Send className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Missões
        </p>
        <MissionPanel projectSlug="aura" />
      </div>
      <SystemHealthStatus />
    </div>
  );
}

function EditorContext() {
  const activeFilePath = useEditorStore((s) => s.activeFile);
  const openFiles = useEditorStore((s) => s.openFiles);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorCol = useEditorStore((s) => s.cursorCol);
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  if (!activeFile) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-zinc-600">Nenhum arquivo aberto</p>
        <SystemHealthStatus />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Arquivo
        </p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <FileCode className="h-3.5 w-3.5 text-zinc-500" />
            <span className="truncate font-medium">{activeFile.name}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span className="capitalize">{activeFile.language}</span>
            <span>Ln {cursorLine}, Col {cursorCol}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Git
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <GitCommit className="h-3 w-3" />
          <span>Use Ctrl+Shift+G para ver diff</span>
        </div>
      </div>
      <SystemHealthStatus />
    </div>
  );
}

function TerminalContext() {
  const commands = [
    'git status',
    'git pull',
    'pytest tests/ -q',
    'pnpm tsc --noEmit',
    'vercel deploy --prod --yes',
  ];

  const sendCommand = (cmd: string) => {
    window.dispatchEvent(new CustomEvent('aura:terminal-command', { detail: cmd }));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Comandos frequentes
        </p>
        <div className="space-y-0.5">
          {commands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => sendCommand(cmd)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Terminal className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              {cmd}
            </button>
          ))}
        </div>
      </div>
      <SystemHealthStatus />
    </div>
  );
}

function DashboardContext() {
  const actions = [
    { label: 'Reiniciar Backend', icon: Play },
    { label: 'Limpar Logs', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
          Ações rápidas
        </p>
        <div className="space-y-0.5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
      <SystemHealthStatus />
    </div>
  );
}

function SystemHealthStatus() {
  const health = useHealth();
  const [doctorLoading, setDoctorLoading] = useState(false);

  const handleDoctor = async () => {
    setDoctorLoading(true);
    await health.runDoctor();
    await health.refetch();
    setDoctorLoading(false);
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
        Sistema
      </p>
      <HealthPanel
        services={health.services}
        overallStatus={health.overallStatus}
        uptimeSeconds={health.uptimeSeconds}
        onRunDoctor={handleDoctor}
        doctorLoading={doctorLoading}
      />
    </div>
  );
}

function getContextContent(activePanel: string) {
  switch (activePanel) {
    case 'chat':
      return <ChatContext />;
    case 'editor':
      return <EditorContext />;
    case 'terminal':
      return <TerminalContext />;
    case 'dashboard':
      return <DashboardContext />;
    default:
      return <ChatContext />;
  }
}

export function ContextSidebar() {
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const activePreset = useWorkspaceStore((s) => s.getActivePreset());
  const rightContext = activePreset.layout.rightContext;
  const [collapsed, setCollapsed] = useState(rightContext === 'collapsed');
  const hoverSidebar = useAdaptiveEdgeSidebar({
    collapsed,
    defaultCollapsed: rightContext !== 'expanded',
    onCollapsedChange: setCollapsed,
    minWidth: 1280,
  });

  useEffect(() => {
    setCollapsed(rightContext === 'collapsed');
  }, [rightContext]);

  if (rightContext === 'hidden') return null;

  return (
    <>
      {hoverSidebar.hoverMode && collapsed && (
        <div
          className="fixed right-0 z-30 hidden w-3 xl:block"
          style={{
            top: 'calc(var(--aura-header-h) + 1rem)',
            bottom: 'calc(var(--aura-status-h) + 1rem)',
          }}
          aria-hidden="true"
          {...hoverSidebar.hotspotHandlers}
        />
      )}
      <aside
        className={cn(
          'app-popover fixed right-4 z-40 hidden overflow-hidden rounded-[1.35rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface)_78%,transparent)] shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition-[width,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] xl:block',
          collapsed ? 'w-14 opacity-100' : 'w-[18rem] opacity-100',
        )}
        style={{
          top: 'calc(var(--aura-header-h) + 1rem)',
          bottom: 'calc(var(--aura-status-h) + 1rem)',
        }}
        {...(hoverSidebar.hoverMode ? hoverSidebar.panelHandlers : {})}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[inherit] bg-transparent">
          <div className="flex items-center justify-between border-b border-white/5 p-2.5">
            {!collapsed && (
              <span className="px-1 text-xs font-medium uppercase tracking-widest text-zinc-600">
                Contexto
              </span>
            )}
            <button
              type="button"
              onClick={hoverSidebar.toggle}
              className="flex items-center justify-center rounded p-1 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
              aria-label={collapsed ? 'Expandir contexto' : 'Recolher contexto'}
            >
              {collapsed ? (
                <ChevronLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {!collapsed && (
            <div className="context-content flex-1 overflow-y-auto p-3">
              {getContextContent(activePanel)}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
