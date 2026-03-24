'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Menu, Search } from 'lucide-react';

import { BrainSelector } from '@/components/chat/brain-selector';
import { EngineToggle } from '@/components/chat/engine-toggle';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { useWorkspaceStore, WORKSPACE_PRESETS } from '@/lib/workspace-store';
import { cn } from '@/lib/utils';

type AppHeaderProps = {
  onOpenSidebar: () => void;
};

function StatusDot() {
  const { runtimeStatus } = useAuraPreferences();
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const isDegraded = runtimeStatus?.status === 'degraded';

  const [showTooltip, setShowTooltip] = useState(false);
  const modelName = runtimeStatus?.model ?? 'desconhecido';
  const latency = runtimeStatus?.uptime_seconds != null ? `${Math.round(runtimeStatus.uptime_seconds)}s uptime` : '';
  const statusText = isOnline ? 'Online' : isDegraded ? 'Degraded' : 'Offline';
  const dotColor = isOnline ? 'bg-green-500' : isDegraded ? 'bg-yellow-500 animate-pulse-dot' : 'bg-red-500';

  return (
    <div
      className="relative flex items-center gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={cn('h-2 w-2 rounded-full', dotColor)} />
      <span className="hidden text-xs text-zinc-400 lg:inline">{statusText}</span>

      {showTooltip && (
        <div className="app-popover absolute right-0 top-full z-50 mt-2 w-56 rounded-[1.1rem] p-3">
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

function WorkspaceSelector() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const preset = WORKSPACE_PRESETS[activeWorkspace] ?? WORKSPACE_PRESETS.chat;
  const presetKeys = ['chat', 'code', 'monitor', 'review', 'focus'] as const;
  const shortcuts = ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-[1rem] px-2.5 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5"
      >
        <span className="text-base leading-none">{preset.icon}</span>
        <span className="hidden font-medium sm:inline">{preset.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>

      {dropdownOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
            aria-label="Fechar"
          />
          <div className="app-popover absolute left-0 top-full z-50 mt-1.5 w-56 rounded-[1.1rem] py-1.5">
            {presetKeys.map((key, i) => {
              const p = WORKSPACE_PRESETS[key];
              const isActive = activeWorkspace === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setWorkspace(key);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[0.95rem] px-3 py-2.5 text-left text-sm transition',
                    isActive
                      ? 'bg-white/5 text-zinc-200'
                      : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300',
                  )}
                >
                  <span className="text-base leading-none">{p.icon}</span>
                  <span className="flex-1">{p.name}</span>
                  {isActive && (
                    <span className="text-[10px] text-zinc-600">ativo</span>
                  )}
                  <kbd className="text-[10px] text-zinc-700">{shortcuts[i]}</kbd>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function AppHeader({ onOpenSidebar }: AppHeaderProps) {
  const togglePalette = useWorkspaceStore((s) => s.toggleCommandPalette);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface)_82%,transparent)] px-3 backdrop-blur-xl">
      {/* Left: Menu + Workspace selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[0.9rem] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <WorkspaceSelector />
      </div>

      {/* Center: Engine + Brain */}
      <div className="flex items-center gap-2">
        <EngineToggle />
        <div className="hidden h-4 w-px bg-white/5 sm:block" />
        <BrainSelector />
      </div>

      {/* Right: Command Palette trigger + Status */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePalette}
          className="inline-flex h-8 items-center gap-1.5 rounded-[0.9rem] px-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          aria-label="Command Palette (Ctrl+K)"
          title="Ctrl+K"
        >
          <Search className="h-4 w-4" />
          <kbd className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-600 sm:inline">
            Ctrl+K
          </kbd>
        </button>
        <div className="hidden h-4 w-px bg-white/5 sm:block" />
        <StatusDot />
      </div>
    </header>
  );
}
