'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCode,
  GitCommit,
  Play,
  Send,
  Server,
  Terminal,
} from 'lucide-react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { useAdaptiveEdgeSidebar } from '@/hooks/use-adaptive-edge-sidebar';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { useEditorStore } from '@/lib/editor-store';
import { cn } from '@/lib/utils';

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
      <SystemMiniStatus />
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
        <SystemMiniStatus />
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
      <SystemMiniStatus />
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
      <SystemMiniStatus />
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
      <SystemMiniStatus />
    </div>
  );
}

function SystemMiniStatus() {
  const { runtimeStatus } = useAuraPreferences();
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const modelName = runtimeStatus?.model ?? 'qwen3.5:9b';

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-600">
        Sistema
      </p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Server className="h-3 w-3" />
            <span>API</span>
          </div>
          <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Server className="h-3 w-3" />
            <span>Modelo</span>
          </div>
          <span className="text-zinc-400">{modelName}</span>
        </div>
      </div>
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
          className="fixed inset-y-0 right-0 z-30 hidden w-3 xl:block"
          style={{ top: 'var(--aura-header-h)' }}
          aria-hidden="true"
          {...hoverSidebar.hotspotHandlers}
        />
      )}
      <aside
        className={cn(
          'context-sidebar hidden shrink-0 border-l border-white/5 bg-zinc-950 transition-[width] duration-200 ease-out lg:block',
          collapsed ? 'w-10' : 'w-56',
        )}
        {...(hoverSidebar.hoverMode ? hoverSidebar.panelHandlers : {})}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/5 p-2">
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
