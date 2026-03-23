'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Cpu, Database, HardDrive, RefreshCw, Server } from 'lucide-react';

import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { cn } from '@/lib/utils';

type DashboardData = {
  system: {
    cpu_percent: number; ram_percent: number; ram_used_gb: number; ram_total_gb: number;
    disk_percent: number; disk_used_gb: number; disk_total_gb: number; uptime_hours: number;
  };
  services: Record<string, { status: string; port?: number; model?: string }>;
  recent_activity: { type: string; summary: string; time: string }[];
  stats: { total_chats: number; total_commands: number; uptime_days: number };
};

function GaugeCard({ label, value, percent, icon: Icon }: { label: string; value: string; percent: number; icon: React.ElementType }) {
  const color = percent > 85 ? 'text-red-400' : percent > 60 ? 'text-yellow-400' : 'text-green-400';
  const strokeColor = percent > 85 ? '#ef4444' : percent > 60 ? '#eab308' : '#22c55e';
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex shrink-0 flex-col items-center rounded-xl border border-white/5 bg-zinc-900 p-4" style={{ width: 130 }}>
      <div className="relative h-[72px] w-[72px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={radius} fill="none" stroke={strokeColor} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-bold', color)}>{Math.round(percent)}%</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-zinc-500">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className="mt-0.5 text-xs text-zinc-400">{value}</span>
    </div>
  );
}

export function MobileDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
      const token = useAuthStore.getState().token || clientEnv.auraToken;
      const res = await fetch(`${prefix}/dashboard`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 30000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const { pullDistance, refreshing, handlers } = usePullRefresh({
    onRefresh: fetchDashboard,
  });

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    );
  }

  if (!data) {
    return <div className="flex h-full items-center justify-center text-red-400 text-sm">Falha ao carregar</div>;
  }

  const { system: sys, services, recent_activity, stats } = data;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mobile-header flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950 px-4 pb-2">
        <h1 className="text-sm font-semibold text-zinc-200">Dashboard</h1>
        <button type="button" onClick={() => { setLoading(true); fetchDashboard(); }} className="rounded-lg p-2 text-zinc-400 active:bg-white/5">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Pull refresh */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center" style={{ height: pullDistance }}>
          <div className={cn('h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent', refreshing && 'animate-spin')} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto" {...handlers}>
        {/* Gauges - horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto px-4 py-4">
          <GaugeCard label="CPU" value={`${sys.cpu_percent}%`} percent={sys.cpu_percent} icon={Cpu} />
          <GaugeCard label="RAM" value={`${sys.ram_used_gb}/${sys.ram_total_gb}GB`} percent={sys.ram_percent} icon={Database} />
          <GaugeCard label="Disk" value={`${sys.disk_percent}%`} percent={sys.disk_percent} icon={HardDrive} />
          <GaugeCard label="Uptime" value={`${sys.uptime_hours}h`} percent={0} icon={Activity} />
        </div>

        {/* Services */}
        <div className="px-4 pb-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            <Server className="h-3 w-3" /> Servicos
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(services).map(([name, svc]) => {
              const isOn = svc.status === 'online' || svc.status === 'running';
              return (
                <div key={name} className="flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-900 px-3 py-2">
                  <span className={cn('h-2 w-2 rounded-full', isOn ? 'bg-green-500' : 'bg-red-500')} />
                  <span className="truncate text-xs text-zinc-300">{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity */}
        <div className="px-4 pb-4">
          <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Atividade recente</h2>
          <div className="space-y-1.5">
            {recent_activity.length === 0 && <p className="text-xs text-zinc-600">Sem atividade</p>}
            {recent_activity.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs">
                <span className="text-zinc-600">{a.type === 'chat' ? '💬' : a.type === 'command' ? '>_' : '🔔'}</span>
                <span className="flex-1 truncate text-zinc-400">{a.summary}</span>
                <span className="shrink-0 text-zinc-600">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mx-4 mb-4 flex items-center justify-around rounded-xl border border-white/5 bg-zinc-900 py-3 text-center">
          <div>
            <p className="text-lg font-semibold text-zinc-200">{stats.total_chats}</p>
            <p className="text-[10px] text-zinc-600">chats</p>
          </div>
          <div className="h-8 w-px bg-white/5" />
          <div>
            <p className="text-lg font-semibold text-zinc-200">{stats.total_commands}</p>
            <p className="text-[10px] text-zinc-600">commands</p>
          </div>
          <div className="h-8 w-px bg-white/5" />
          <div>
            <p className="text-lg font-semibold text-zinc-200">{stats.uptime_days}d</p>
            <p className="text-[10px] text-zinc-600">uptime</p>
          </div>
        </div>
      </div>
    </div>
  );
}
