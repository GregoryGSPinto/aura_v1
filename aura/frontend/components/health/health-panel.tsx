'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Cpu,
  Globe,
  Loader2,
  Monitor,
  Mic,
  Server,
  Stethoscope,
  Terminal,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ServiceHealth } from '@/hooks/use-health';

// ── Icon mapping ────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ElementType> = {
  ollama: Server,
  modelo: Cpu,
  backend_self: Monitor,
  voice_runtime: Mic,
  browser_runtime: Globe,
  claude_bridge: Cloud,
  terminal_bridge: Terminal,
  ngrok_tunnel: Activity,
};

const SERVICE_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  modelo: 'Modelo',
  backend_self: 'Backend',
  voice_runtime: 'Voice',
  browser_runtime: 'Browser',
  claude_bridge: 'Claude CLI',
  terminal_bridge: 'Terminal',
  ngrok_tunnel: 'Ngrok Tunnel',
};

// ── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online'
      ? 'bg-green-500'
      : status === 'not_configured'
        ? 'bg-yellow-500'
        : status === 'degraded'
          ? 'bg-yellow-500'
          : 'bg-red-500';

  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', color)} />;
}

// ── Compact version (for status bar) ────────────────────────────────────────

export function HealthDotsCompact({
  services,
  overallStatus,
}: {
  services: Record<string, ServiceHealth>;
  overallStatus: string;
}) {
  const entries = Object.values(services);
  if (entries.length === 0) return null;

  // Show just the core services dots
  const coreServices = ['ollama', 'modelo', 'backend_self', 'claude_bridge', 'terminal_bridge'];

  return (
    <div className="flex items-center gap-1">
      {coreServices.map((key) => {
        const svc = services[key];
        if (!svc) return null;
        return (
          <span
            key={key}
            title={`${SERVICE_LABELS[key] ?? key}: ${svc.status}`}
          >
            <StatusDot status={svc.status} />
          </span>
        );
      })}
    </div>
  );
}

// ── Full panel version ──────────────────────────────────────────────────────

export function HealthPanel({
  services,
  overallStatus,
  uptimeSeconds,
  onRunDoctor,
  doctorLoading = false,
}: {
  services: Record<string, ServiceHealth>;
  overallStatus: string;
  uptimeSeconds: number;
  onRunDoctor?: () => void;
  doctorLoading?: boolean;
}) {
  const entries = Object.entries(services);
  const uptimeStr = formatUptime(uptimeSeconds);

  return (
    <div className="space-y-3">
      {/* Overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {overallStatus === 'healthy' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {overallStatus === 'degraded' && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
          {overallStatus === 'unhealthy' && <XCircle className="h-4 w-4 text-red-400" />}
          {overallStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
          {overallStatus === 'unreachable' && <XCircle className="h-4 w-4 text-red-400" />}
          <span
            className={cn(
              'text-xs font-medium uppercase tracking-wider',
              overallStatus === 'healthy'
                ? 'text-green-400'
                : overallStatus === 'degraded'
                  ? 'text-yellow-400'
                  : 'text-red-400',
            )}
          >
            {overallStatus === 'unreachable' ? 'Offline' : overallStatus}
          </span>
        </div>
        <span className="text-[11px] text-zinc-600">{uptimeStr}</span>
      </div>

      {/* Services list */}
      <div className="space-y-1">
        {entries.map(([key, svc]) => {
          const Icon = SERVICE_ICONS[key] ?? Server;
          const label = SERVICE_LABELS[key] ?? key;
          const latency = svc.latency_ms != null ? `${Math.round(svc.latency_ms)}ms` : '';

          return (
            <div key={key} className="group">
              <div className="flex items-center justify-between rounded-lg px-1.5 py-1 transition hover:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <StatusDot status={svc.status} />
                  <Icon className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-400">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {latency && <span className="text-[10px] text-zinc-600">{latency}</span>}
                  <span
                    className={cn(
                      'text-[10px]',
                      svc.status === 'online'
                        ? 'text-green-400/70'
                        : svc.status === 'not_configured'
                          ? 'text-yellow-400/70'
                          : 'text-red-400/70',
                    )}
                  >
                    {svc.status}
                  </span>
                </div>
              </div>
              {/* Error / action hint (visible on hover or when offline) */}
              {svc.status !== 'online' && svc.status !== 'not_configured' && svc.action && (
                <p className="px-6 pb-0.5 text-[10px] text-zinc-600">{svc.action}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Doctor button */}
      {onRunDoctor && (
        <button
          type="button"
          onClick={onRunDoctor}
          disabled={doctorLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
        >
          {doctorLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Stethoscope className="h-3.5 w-3.5" />
          )}
          Diagnosticar
        </button>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
