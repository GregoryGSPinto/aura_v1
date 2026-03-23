'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Cpu, Database, HardDrive, RefreshCw, Server, Wifi } from 'lucide-react';

import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type DashboardData = {
  system: {
    cpu_percent: number; ram_percent: number; ram_used_gb: number; ram_total_gb: number;
    disk_percent: number; disk_used_gb: number; disk_total_gb: number; uptime_hours: number;
  };
  services: Record<string, { status: string; port?: number; model?: string }>;
  token_budget: { daily_used_usd: number; daily_limit_usd: number; monthly_used_usd: number; monthly_limit_usd: number; tier: string };
  connectors: Record<string, { configured: boolean }>;
  recent_activity: { type: string; summary: string; time: string }[];
  stats: { total_chats: number; total_commands: number; uptime_days: number };
};

function MetricCard({ label, value, percent, icon: Icon }: { label: string; value: string; percent: number; icon: React.ElementType }) {
  const color = percent > 85 ? 'text-red-400' : percent > 60 ? 'text-yellow-400' : 'text-green-400';
  const barColor = percent > 85 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', color)}>{value}</p>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function ServiceDot({ name, status, detail }: { name: string; status: string; detail?: string }) {
  const isOnline = status === 'online' || status === 'running';
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
      <span className="text-sm text-zinc-300">{name}</span>
      {detail && <span className="text-xs text-zinc-600">{detail}</span>}
    </div>
  );
}

function BudgetBar({ label, used, limit, tier }: { label: string; used: number; limit: number; tier?: string }) {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const color = (tier === 'red' || pct > 80) ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="py-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">${used.toFixed(2)} / ${limit.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-zinc-800">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
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

  if (loading && !data) {
    return <div className="flex h-64 items-center justify-center text-zinc-600">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="flex h-64 items-center justify-center text-red-400">Failed to load dashboard</div>;
  }

  const { system: sys, services, token_budget, connectors, recent_activity, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
        <button
          type="button"
          onClick={() => { setLoading(true); fetchDashboard(); }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="CPU" value={`${sys.cpu_percent}%`} percent={sys.cpu_percent} icon={Cpu} />
        <MetricCard label="RAM" value={`${sys.ram_used_gb}/${sys.ram_total_gb}GB`} percent={sys.ram_percent} icon={Database} />
        <MetricCard label="Disk" value={`${sys.disk_percent}%`} percent={sys.disk_percent} icon={HardDrive} />
        <MetricCard label="Uptime" value={`${sys.uptime_hours}h`} percent={0} icon={Activity} />
      </div>

      {/* Services + Token Budget */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Server className="h-3.5 w-3.5" /> Services
          </h2>
          {Object.entries(services).map(([name, svc]) => (
            <ServiceDot key={name} name={name} status={svc.status} detail={svc.port ? `:${svc.port}` : svc.model} />
          ))}
        </div>
        <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Token Budget</h2>
          <BudgetBar label="Daily" used={token_budget.daily_used_usd} limit={token_budget.daily_limit_usd} tier={token_budget.tier} />
          <BudgetBar label="Monthly" used={token_budget.monthly_used_usd} limit={token_budget.monthly_limit_usd} />
        </div>
      </div>

      {/* Connectors + Activity */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <Wifi className="h-3.5 w-3.5" /> Connectors
          </h2>
          {Object.entries(connectors).map(([name, info]) => (
            <ServiceDot key={name} name={name} status={info.configured ? 'online' : 'offline'} />
          ))}
        </div>
        <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Recent Activity</h2>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {recent_activity.length === 0 && <p className="text-xs text-zinc-600">No recent activity</p>}
            {recent_activity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="text-zinc-600">{a.type}</span>
                <span className="flex-1 truncate text-zinc-400">{a.summary}</span>
                <span className="shrink-0 text-zinc-600">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-zinc-900 p-4 text-sm text-zinc-400">
        <span>{stats.total_chats} chats</span>
        <span className="text-zinc-700">&middot;</span>
        <span>{stats.total_commands} commands</span>
        <span className="text-zinc-700">&middot;</span>
        <span>{stats.uptime_days}d uptime</span>
      </div>
    </div>
  );
}
