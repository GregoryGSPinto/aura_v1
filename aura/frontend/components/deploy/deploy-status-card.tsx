'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  GitBranch,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface DeployInfo {
  status: string;
  github?: { repo: string; branch: string; url: string };
  vercel?: { project: string; url: string; status: string };
  last_deploy?: string;
  error?: string;
}

const STATUS_MAP: Record<string, { color: string; icon: typeof Cloud; label: string }> = {
  ready: { color: 'text-emerald-400', icon: CheckCircle2, label: 'Online' },
  building: { color: 'text-blue-400', icon: Loader2, label: 'Building' },
  error: { color: 'text-red-400', icon: XCircle, label: 'Erro' },
  not_configured: { color: 'text-zinc-500', icon: Cloud, label: 'N/A' },
};

export function DeployStatusCard({ projectSlug }: { projectSlug?: string }) {
  const [info, setInfo] = useState<DeployInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectSlug) return;
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(`${base}/api/v1/deploy/status/${projectSlug}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInfo(data.data ?? data);
      }
    } catch {
      setInfo({ status: 'not_configured' });
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => { load(); }, [load]);

  const cfg = STATUS_MAP[info?.vercel?.status || info?.status || 'not_configured'] || STATUS_MAP.not_configured;
  const Icon = cfg.icon;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Icon className={cn('h-3.5 w-3.5', cfg.color, info?.vercel?.status === 'building' && 'animate-spin')} />
          <span className="font-medium text-zinc-300">Deploy</span>
          <span className={cn('text-[10px]', cfg.color)}>{cfg.label}</span>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded p-1 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
        >
          <RotateCcw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {info?.github && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <GitBranch className="h-2.5 w-2.5" />
          <span>{info.github.repo}</span>
          <span>·</span>
          <span>{info.github.branch || 'main'}</span>
        </div>
      )}

      {info?.vercel?.url && (
        <a
          href={info.vercel.url.startsWith('http') ? info.vercel.url : `https://${info.vercel.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {info.vercel.url.replace(/^https?:\/\//, '').slice(0, 40)}
        </a>
      )}

      {info?.error && (
        <p className="mt-1 text-[10px] text-red-400">{info.error}</p>
      )}
    </div>
  );
}
