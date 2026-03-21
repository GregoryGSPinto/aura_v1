'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { fetchProviders, setProviderOverride, startEngine } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';
import type { ProviderName } from '@/lib/types';
import { cn } from '@/lib/utils';
import { notifyError, notifyInfo } from '@/lib/notifications';

type BrainOption = {
  id: ProviderName;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgActive: string;
  badge?: string;
};

const BRAIN_OPTIONS: BrainOption[] = [
  { id: 'auto', label: 'Auto (ModelRouter)', shortLabel: 'Auto', icon: '\u{1F916}', color: 'text-zinc-400', bgActive: 'bg-zinc-700/50', badge: undefined },
  { id: 'ollama', label: 'Qwen 3.5 (local)', shortLabel: 'Qwen', icon: '\u{1F9E0}', color: 'text-emerald-400', bgActive: 'bg-emerald-900/30', badge: 'local' },
  { id: 'anthropic', label: 'Claude (Anthropic)', shortLabel: 'Claude', icon: '\u{2726}', color: 'text-amber-400', bgActive: 'bg-amber-900/30', badge: 'API' },
  { id: 'openai', label: 'GPT-4o (OpenAI)', shortLabel: 'GPT', icon: '\u{25C6}', color: 'text-blue-400', bgActive: 'bg-blue-900/30', badge: 'API' },
];

export function BrainSelector() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProvider = useChatStore((s) => s.activeProvider);
  const providerStatuses = useChatStore((s) => s.providerStatuses);
  const engineStatus = useChatStore((s) => s.engineStatus);
  const setActiveProvider = useChatStore((s) => s.setActiveProvider);
  const setProviderStatuses = useChatStore((s) => s.setProviderStatuses);
  const setEngineStatus = useChatStore((s) => s.setEngineStatus);

  const activeBrain = BRAIN_OPTIONS.find((b) => b.id === activeProvider) ?? BRAIN_OPTIONS[0];

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetchProviders();
      setProviderStatuses(res.data.providers);
      if (res.data.override) {
        setActiveProvider(res.data.override as ProviderName);
      }
    } catch {
      // silent — status will show as unknown
    }
  }, [setActiveProvider, setProviderStatuses]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = async (option: BrainOption) => {
    if (option.id === activeProvider) {
      setOpen(false);
      return;
    }

    if (option.id !== 'auto' && option.id !== 'ollama') {
      const status = providerStatuses[option.id];
      if (!status?.configured) {
        notifyError('Provider indisponivel', `${option.label} nao configurado. Defina a API key no .env.`);
        return;
      }
    }

    // If selecting Ollama and engine is off, offer to start
    if (option.id === 'ollama' && engineStatus?.status !== 'running') {
      setLoading(true);
      try {
        notifyInfo('Ligando motor', 'Iniciando Ollama...');
        const engineRes = await startEngine();
        setEngineStatus(engineRes.data);
        if (engineRes.data.status !== 'running') {
          notifyError('Motor nao ligou', engineRes.data.message ?? 'Ollama nao iniciou.');
          return;
        }
        notifyInfo('Motor ligado', 'Ollama iniciado.');
      } catch (err) {
        notifyError('Erro', err instanceof Error ? err.message : 'Falha ao ligar motor.');
        return;
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      await setProviderOverride(option.id);
      setActiveProvider(option.id);
      notifyInfo('Cerebro alterado', `Agora usando: ${option.label}`);
      setOpen(false);
    } catch (err) {
      notifyError('Erro', err instanceof Error ? err.message : 'Falha ao trocar provider.');
    } finally {
      setLoading(false);
    }
  };

  const ollamaRunning = engineStatus?.status === 'running';

  const isAvailable = (id: ProviderName) => {
    if (id === 'auto') return true;
    if (id === 'ollama') return true; // always clickable — will auto-start if needed
    const status = providerStatuses[id];
    return status?.configured ?? false;
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
          'border border-white/5 hover:border-white/10 hover:bg-white/5',
          activeBrain.color,
        )}
      >
        <span>{activeBrain.icon}</span>
        <span className="hidden sm:inline">{activeBrain.shortLabel}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-white/5 bg-zinc-900 p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="mb-1 px-2.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Selecionar cerebro
          </p>
          {BRAIN_OPTIONS.map((option) => {
            const available = isAvailable(option.id);
            const isActive = option.id === activeProvider;
            return (
              <button
                key={option.id}
                type="button"
                disabled={!available || loading}
                onClick={() => void handleSelect(option)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition',
                  isActive ? option.bgActive : 'hover:bg-white/5',
                  available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                )}
                title={!available ? 'API key nao configurada' : undefined}
              >
                <span className="text-sm">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium', isActive ? option.color : 'text-zinc-300')}>
                    {option.shortLabel}
                  </div>
                  <div className="truncate text-[10px] text-zinc-600">
                    {option.id === 'ollama' && !ollamaRunning
                      ? 'Offline \u2014 motor desligado'
                      : option.label}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {option.badge && (
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-medium',
                      option.badge === 'local' ? 'bg-emerald-900/40 text-emerald-500' : 'bg-zinc-800 text-zinc-500',
                    )}>
                      {option.badge}
                    </span>
                  )}
                  {option.id === 'ollama' && !ollamaRunning ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  ) : available ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
