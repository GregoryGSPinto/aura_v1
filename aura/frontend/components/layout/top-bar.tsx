'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, Settings2 } from 'lucide-react';

import { useAuraPreferences } from '@/components/providers/app-provider';
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
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Aura</span>
      </div>

      <div className="flex items-center gap-3">
        <StatusDot />
        <Link
          href="/settings"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          aria-label="Configuracoes"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
