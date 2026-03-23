'use client';

/**
 * Preview Panel — Mostra localhost do Mac via proxy.
 *
 * Features:
 * - URL bar no topo (editable, como browser)
 * - iframe carrega via proxy do backend
 * - Botao refresh
 * - Dropdown de portas ativas (auto-detect)
 * - Indicador de erro (vermelho se nada rodando)
 * - Device simulation (mobile/tablet/desktop)
 * - Auto-refresh quando arquivo e salvo no editor
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

import { usePreviewStore, type DevicePreview } from '@/lib/preview-store';
import { useEditorStore } from '@/lib/editor-store';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

function getProxyUrl(targetUrl: string): string {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  const token = useAuthStore.getState().token || clientEnv.auraToken;
  return `${prefix}/preview/proxy?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(token)}`;
}

const DEVICE_WIDTHS: Record<DevicePreview, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

export function PreviewPanel() {
  const {
    targetUrl, setTargetUrl,
    device, setDevice,
    autoRefresh, setAutoRefresh,
    refreshKey, triggerRefresh,
    activePorts, setActivePorts,
  } = usePreviewStore();

  const openFiles = useEditorStore((s) => s.openFiles);
  const [urlInput, setUrlInput] = useState(targetUrl);
  const [loading, setLoading] = useState(false);
  const [showPorts, setShowPorts] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevModifiedRef = useRef(0);

  // Sync URL input with store
  useEffect(() => {
    setUrlInput(targetUrl);
  }, [targetUrl]);

  // Fetch active ports on mount
  const fetchPorts = useCallback(async () => {
    try {
      const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
      const token = useAuthStore.getState().token || clientEnv.auraToken;

      const res = await fetch(`${prefix}/preview/ports`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setActivePorts(data.data.ports);
      }
    } catch {
      // silent
    }
  }, [setActivePorts]);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  // Auto-refresh when editor saves (debounced)
  useEffect(() => {
    if (!autoRefresh) return;

    const modifiedCount = openFiles.filter((f) => !f.modified).length;
    // Detect when a file goes from modified to saved
    if (modifiedCount > prevModifiedRef.current) {
      const timer = setTimeout(() => {
        triggerRefresh();
      }, 1000);
      prevModifiedRef.current = modifiedCount;
      return () => clearTimeout(timer);
    }
    prevModifiedRef.current = modifiedCount;
  }, [openFiles, autoRefresh, triggerRefresh]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    setTargetUrl(urlInput);
    triggerRefresh();
  };

  const handleRefresh = () => {
    triggerRefresh();
    setLoading(true);
  };

  const handlePortSelect = (port: number) => {
    const url = `http://localhost:${port}`;
    setTargetUrl(url);
    setUrlInput(url);
    setShowPorts(false);
    triggerRefresh();
  };

  const proxyUrl = getProxyUrl(targetUrl);

  // Extract port from URL for display
  const currentPort = (() => {
    try {
      return new URL(targetUrl).port || '80';
    } catch {
      return '?';
    }
  })();

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* URL bar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 px-2 py-1.5">
        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>

        {/* URL input */}
        <form onSubmit={handleNavigate} className="flex-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500/50"
            placeholder="http://localhost:3000"
          />
        </form>

        {/* Port dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowPorts(!showPorts); if (!showPorts) fetchPorts(); }}
            className="rounded px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            title="Portas ativas"
          >
            :{currentPort}
          </button>
          {showPorts && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                onClick={() => setShowPorts(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-white/5 bg-zinc-900 py-1 shadow-lg">
                {activePorts.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-zinc-600">Nenhuma porta ativa</p>
                ) : (
                  activePorts.map((p) => (
                    <button
                      key={p.port}
                      type="button"
                      onClick={() => handlePortSelect(p.port)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-white/5"
                    >
                      <span className="text-zinc-300">:{p.port}</span>
                      <span className="text-zinc-600">{p.type}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Device buttons */}
        <div className="hidden items-center gap-0.5 sm:flex">
          {([
            { id: 'mobile' as const, icon: Smartphone },
            { id: 'tablet' as const, icon: Tablet },
            { id: 'desktop' as const, icon: Monitor },
          ]).map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDevice(d.id)}
                className={cn(
                  'rounded p-1 transition',
                  device === d.id ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-400',
                )}
                title={d.id}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Auto-refresh toggle */}
        <button
          type="button"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            'rounded p-1 transition',
            autoRefresh ? 'text-green-400' : 'text-zinc-600',
          )}
          title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        >
          {autoRefresh ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Open in new tab */}
        <a
          href={proxyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          title="Abrir em nova aba"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* iframe */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-zinc-900">
        <iframe
          ref={iframeRef}
          key={refreshKey}
          src={proxyUrl}
          title="Preview"
          className="h-full border-0 bg-white"
          style={{
            width: DEVICE_WIDTHS[device],
            maxWidth: '100%',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
