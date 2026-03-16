'use client';

import { useState } from 'react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { useChatStore } from '@/lib/chat-store';
import { getAuraChatMode } from '@/lib/chat-modes';
import { clientEnv } from '@/lib/env';

export function StatusBar() {
  const { runtimeStatus } = useAuraPreferences();
  const selectedModeId = useChatStore((state) => state.selectedModeId);
  const currentMode = getAuraChatMode(selectedModeId);
  const [showPopover, setShowPopover] = useState(false);

  const modelName = runtimeStatus?.model ?? 'qwen3.5:9b';
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const sessionType = isOnline ? 'Sessao local' : 'Offline';
  const version = runtimeStatus?.version ?? '5.x';

  return (
    <div className="relative shrink-0 border-t border-white/5 bg-transparent px-4">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="flex h-7 w-full items-center gap-2 text-xs text-zinc-600 transition hover:text-zinc-400"
      >
        <span className="hidden sm:inline">{currentMode.shortLabel}</span>
        <span className="hidden text-zinc-700 sm:inline">&middot;</span>
        <span>{modelName}</span>
        <span className="text-zinc-700">&middot;</span>
        <span className="hidden sm:inline">{sessionType}</span>
      </button>

      {showPopover && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
            aria-label="Fechar diagnostico"
          />
          <div className="absolute bottom-full left-4 z-50 mb-2 w-72 rounded-lg border border-white/5 bg-zinc-900 p-4 shadow-lg">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Diagnostico</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Versao</span>
                <span className="text-zinc-300">Aura {version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Modo</span>
                <span className="text-zinc-300">{currentMode.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Modelo</span>
                <span className="text-zinc-300">{modelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Backend</span>
                <span className="text-zinc-300">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">API</span>
                <span className="truncate pl-4 text-zinc-300">{clientEnv.apiUrl || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sessao</span>
                <span className="text-zinc-300">{sessionType}</span>
              </div>
              {runtimeStatus?.ollama && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ollama</span>
                  <span className="text-zinc-300">
                    {runtimeStatus.ollama.model_available ? 'Modelo pronto' : 'Modelo ausente'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
