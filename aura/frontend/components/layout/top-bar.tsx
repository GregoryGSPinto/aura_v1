'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Code2, Globe, Menu, MessageSquareText, Settings2, SquareTerminal } from 'lucide-react';

import { BrainSelector } from '@/components/chat/brain-selector';
import { EngineToggle } from '@/components/chat/engine-toggle';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { usePreviewStore } from '@/lib/preview-store';
import { useTerminalStore } from '@/lib/terminal-store';
import { cn } from '@/lib/utils';

type AppHeaderProps = {
  onOpenSidebar: () => void;
};

function StatusDot() {
  const { runtimeStatus } = useAuraPreferences();
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const isDegraded = runtimeStatus?.status === 'degraded';
  const modelName = runtimeStatus?.model ?? 'desconhecido';
  const latency = runtimeStatus?.uptime_seconds != null ? `${Math.round(runtimeStatus.uptime_seconds)}s uptime` : '';

  const [showTooltip, setShowTooltip] = useState(false);

  const dotColor = isOnline
    ? 'bg-green-500'
    : isDegraded
      ? 'bg-yellow-500 animate-pulse-dot'
      : 'bg-red-500';

  const statusText = isOnline ? 'Online' : isDegraded ? 'Degraded' : 'Offline';

  return (
    <div
      className="relative flex items-center gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={cn('h-2 w-2 rounded-full', dotColor)} />
      <span className="hidden text-xs text-zinc-400 lg:inline">{statusText}</span>

      {showTooltip && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/5 bg-zinc-900 p-3 shadow-lg">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Backend</span>
              <span className="text-zinc-300">{statusText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Modelo</span>
              <span className="text-zinc-300">{modelName}</span>
            </div>
            {latency && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Uptime</span>
                <span className="text-zinc-300">{latency}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppHeader({ onOpenSidebar }: AppHeaderProps) {
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);
  const isTerminalOpen = useTerminalStore((s) => s.isOpen);
  const togglePreview = usePreviewStore((s) => s.togglePreview);
  const isPreviewOpen = usePreviewStore((s) => s.isOpen);
  const [ideMode, setIdeMode] = useState(false);

  type AuraWindow = Window & { __auraIdeMode?: boolean; __auraToggleIdeMode?: () => void };

  // Sync IDE mode from page state
  useEffect(() => {
    const check = () => {
      setIdeMode(!!(window as AuraWindow).__auraIdeMode);
    };
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, []);

  const toggleIdeMode = () => {
    const w = window as AuraWindow;
    if (w.__auraToggleIdeMode) {
      w.__auraToggleIdeMode();
      setIdeMode(!ideMode);
    }
  };

  // Keyboard shortcut: Ctrl+`
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold tracking-tight text-zinc-100">Aura</span>
      </div>

      <div className="flex items-center gap-3">
        <EngineToggle />
        <BrainSelector />
        {/* IDE / Chat toggle */}
        <button
          type="button"
          onClick={toggleIdeMode}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition hover:bg-white/5',
            ideMode ? 'text-blue-400 bg-white/5' : 'text-zinc-400 hover:text-zinc-200',
          )}
          aria-label={ideMode ? 'Modo Chat (Ctrl+Shift+I)' : 'Modo IDE (Ctrl+Shift+I)'}
          title={ideMode ? 'Modo Chat (Ctrl+Shift+I)' : 'Modo IDE (Ctrl+Shift+I)'}
        >
          {ideMode ? <MessageSquareText className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{ideMode ? 'Chat' : 'IDE'}</span>
        </button>
        <button
          type="button"
          onClick={toggleTerminal}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/5',
            isTerminalOpen ? 'text-purple-400 bg-white/5' : 'text-zinc-400 hover:text-zinc-200',
          )}
          aria-label="Terminal (Ctrl+`)"
          title="Terminal (Ctrl+`)"
        >
          <SquareTerminal className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={togglePreview}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/5',
            isPreviewOpen ? 'text-green-400 bg-white/5' : 'text-zinc-400 hover:text-zinc-200',
          )}
          aria-label="Preview (Ctrl+Shift+V)"
          title="Preview (Ctrl+Shift+V)"
        >
          <Globe className="h-5 w-5" />
        </button>
        <StatusDot />
        <Link
          href="/settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          aria-label="Configuracoes"
        >
          <Settings2 className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
