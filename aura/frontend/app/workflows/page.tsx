'use client';

import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type Workflow = {
  id: string; name: string; description: string;
  trigger: { type: string; event?: string; cron?: string; interval_minutes?: number };
  actions: { type: string; command?: string; title?: string; body?: string }[];
  enabled: boolean; created_at: string; last_run: string | null; run_count: number;
};

function getApiPrefix(): string {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

function getHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token || clientEnv.auraToken;
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function triggerLabel(trigger: Workflow['trigger']): string {
  if (trigger.type === 'schedule') {
    if (trigger.cron) return `Cron: ${trigger.cron}`;
    if (trigger.interval_minutes) return `Every ${trigger.interval_minutes}min`;
  }
  if (trigger.type === 'event') return `Event: ${trigger.event || 'unknown'}`;
  return trigger.type;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const prefix = getApiPrefix();

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${prefix}/workflows`, { headers: getHeaders() });
      const json = await res.json();
      if (json.success) setWorkflows(json.data.workflows);
    } catch { /* silent */ }
    setLoading(false);
  }, [prefix]);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`${prefix}/workflows/${id}`, {
      method: 'PUT', headers: getHeaders(),
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchWorkflows();
  };

  const handleExecute = async (id: string) => {
    setActionMsg('Executing...');
    const res = await fetch(`${prefix}/workflows/${id}/execute`, {
      method: 'POST', headers: getHeaders(),
    });
    const json = await res.json();
    setActionMsg(json.success ? 'Executed!' : 'Failed');
    setTimeout(() => setActionMsg(''), 3000);
    fetchWorkflows();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${prefix}/workflows/${id}`, { method: 'DELETE', headers: getHeaders() });
    fetchWorkflows();
  };

  const handleCreateSample = async () => {
    await fetch(`${prefix}/workflows`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({
        name: 'health-check-hourly',
        description: 'Check system health every hour',
        trigger: { type: 'schedule', interval_minutes: 60 },
        actions: [
          { type: 'command', command: 'echo "Health check OK — $(date)"' },
          { type: 'notify', title: 'Aura Health', body: 'System check completed' },
        ],
      }),
    });
    fetchWorkflows();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Automations</h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-xs text-zinc-500">{actionMsg}</span>}
          <button type="button" onClick={handleCreateSample} className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
          <button type="button" onClick={() => { setLoading(true); fetchWorkflows(); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {workflows.length === 0 && !loading && (
        <div className="rounded-xl border border-white/5 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-500">No workflows yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Create one from the chat: &quot;Aura, every hour check system health&quot;</p>
        </div>
      )}

      <div className="space-y-3">
        {workflows.map((w) => (
          <div key={w.id} className="rounded-xl border border-white/5 bg-zinc-900 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-zinc-200">{w.name}</h3>
                {w.description && <p className="mt-0.5 text-xs text-zinc-500">{w.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">{triggerLabel(w.trigger)}</span>
                  {w.actions.map((a, i) => (
                    <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-500">{a.type}: {a.command || a.title || a.body || '...'}</span>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-zinc-600">
                  Runs: {w.run_count} &middot; Last: {w.last_run || 'never'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => handleToggle(w.id, w.enabled)} className={cn('rounded p-1.5 transition', w.enabled ? 'text-green-400' : 'text-zinc-600')}>
                  {w.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button type="button" onClick={() => handleExecute(w.id)} className="rounded p-1.5 text-zinc-400 hover:bg-white/5 hover:text-blue-400">
                  <Play className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleDelete(w.id)} className="rounded p-1.5 text-zinc-600 hover:bg-white/5 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
