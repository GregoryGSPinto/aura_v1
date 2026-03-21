'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Power } from 'lucide-react';

import { fetchEngineStatus, startEngine, stopEngine } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';
import { cn } from '@/lib/utils';
import { notifyError, notifyInfo } from '@/lib/notifications';

type EngineState = 'running' | 'starting' | 'stopped' | 'stopping' | 'error';

export function EngineToggle() {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const engineStatus = useChatStore((s) => s.engineStatus);
  const setEngineStatus = useChatStore((s) => s.setEngineStatus);
  const activeProvider = useChatStore((s) => s.activeProvider);
  const setActiveProvider = useChatStore((s) => s.setActiveProvider);

  const status: EngineState = engineStatus?.status ?? 'stopped';
  const memoryMb = engineStatus?.memory?.rss_mb;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetchEngineStatus();
      setEngineStatus(res.data);
    } catch {
      // silent
    }
  }, [setEngineStatus]);

  // Boot fetch + polling
  useEffect(() => {
    void refreshStatus();

    const isTransitioning = status === 'starting' || status === 'stopping';
    const interval = isTransitioning ? 5000 : 30000;

    pollRef.current = setInterval(() => void refreshStatus(), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshStatus, status]);

  // Click outside to close confirm dialog
  useEffect(() => {
    if (!showConfirm) return;
    function handleClickOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setShowConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showConfirm]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await startEngine();
      setEngineStatus(res.data);
      if (res.data.status === 'running') {
        notifyInfo('Motor ligado', 'Ollama iniciado com sucesso.');
      } else if (res.data.status === 'error') {
        notifyError('Erro', res.data.message ?? 'Falha ao iniciar Ollama.');
      }
    } catch (err) {
      notifyError('Erro', err instanceof Error ? err.message : 'Falha ao iniciar motor.');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const res = await stopEngine();
      setEngineStatus(res.data);
      if (res.data.status === 'stopped') {
        notifyInfo('Motor desligado', 'Memoria liberada.');
        // Auto-switch provider if Qwen was active
        if (activeProvider === 'ollama') {
          setActiveProvider('auto');
          notifyInfo('Provider alterado', 'Troquei pra Auto automaticamente.');
        }
      } else if (res.data.status === 'error') {
        notifyError('Erro', res.data.message ?? 'Falha ao parar Ollama.');
      }
    } catch (err) {
      notifyError('Erro', err instanceof Error ? err.message : 'Falha ao parar motor.');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (loading) return;
    if (status === 'running') {
      setShowConfirm(true);
    } else if (status === 'stopped' || status === 'error') {
      void handleStart();
    }
  };

  const isTransitioning = status === 'starting' || status === 'stopping';

  const borderColor = {
    running: 'border-emerald-500/50',
    starting: 'border-yellow-500/50',
    stopped: 'border-zinc-700',
    stopping: 'border-red-500/50',
    error: 'border-red-500/50',
  }[status];

  const iconColor = {
    running: 'text-emerald-400',
    starting: 'text-yellow-400',
    stopped: 'text-zinc-600',
    stopping: 'text-red-400',
    error: 'text-red-400',
  }[status];

  const glowColor = {
    running: 'shadow-emerald-500/20',
    starting: 'shadow-yellow-500/20',
    stopped: '',
    stopping: 'shadow-red-500/20',
    error: 'shadow-red-500/20',
  }[status];

  const labelText = {
    running: memoryMb ? `${(memoryMb / 1024).toFixed(1)} GB` : 'On',
    starting: 'Ligando...',
    stopped: 'Off',
    stopping: 'Parando...',
    error: 'Erro',
  }[status];

  return (
    <div className="relative" ref={confirmRef}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || isTransitioning}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all',
          'hover:bg-white/5',
          borderColor,
          glowColor && `shadow-sm ${glowColor}`,
          (loading || isTransitioning) && 'cursor-wait opacity-70',
        )}
        title={status === 'stopped' ? 'Ligar motor Ollama' : status === 'running' ? 'Desligar motor Ollama' : status}
      >
        <Power
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            iconColor,
            isTransitioning && 'animate-pulse',
          )}
        />
        <span className={cn('hidden sm:inline', iconColor)}>{labelText}</span>
      </button>

      {/* Confirm stop dialog */}
      {showConfirm && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-white/5 bg-zinc-900 p-3 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-xs text-zinc-300">
            Desligar o modelo local?
          </p>
          {memoryMb ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              Libera {(memoryMb / 1024).toFixed(1)} GB de RAM.
            </p>
          ) : null}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleStop()}
              className="flex-1 rounded-md bg-red-600/80 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-red-600"
            >
              Desligar
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
