'use client';

import { useState } from 'react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { HealthDotsCompact, HealthPanel } from '@/components/health/health-panel';
import { useHealth } from '@/hooks/use-health';
import { useChatStore } from '@/lib/chat-store';
import { useEditorStore } from '@/lib/editor-store';
import { useGitStore } from '@/lib/git-store';
import { usePreviewStore } from '@/lib/preview-store';
import { getAuraChatMode } from '@/lib/chat-modes';
import { clientEnv } from '@/lib/env';
export function StatusBar() {
  const { runtimeStatus } = useAuraPreferences();
  const health = useHealth();
  const selectedModeId = useChatStore((state) => state.selectedModeId);
  const currentMode = getAuraChatMode(selectedModeId);
  const [showPopover, setShowPopover] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);

  const activeFilePath = useEditorStore((s) => s.activeFile);
  const openFiles = useEditorStore((s) => s.openFiles);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorCol = useEditorStore((s) => s.cursorCol);
  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const gitBranch = useGitStore((s) => s.branch);
  const gitAhead = useGitStore((s) => s.ahead);
  const previewOpen = usePreviewStore((s) => s.isOpen);
  const previewUrl = usePreviewStore((s) => s.targetUrl);
  const wsConnected = useChatStore((state) => state.wsConnected);

  const previewPort = (() => {
    if (!previewOpen) return null;
    try { return new URL(previewUrl).port || '80'; } catch { return null; }
  })();

  const modelName = runtimeStatus?.model ?? 'qwen3.5:9b';
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const sessionType = isOnline ? 'Sessao local' : 'Offline';
  const version = runtimeStatus?.version ?? '5.x';

  const handleDoctor = async () => {
    setDoctorLoading(true);
    await health.runDoctor();
    await health.refetch();
    setDoctorLoading(false);
  };

  return (
    <div className="relative shrink-0 border-t border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_62%,transparent)] px-4 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[62rem] 2xl:max-w-[66rem]">
        <button
          type="button"
          onClick={() => setShowPopover(!showPopover)}
          className="flex h-7 w-full items-center gap-2 text-xs text-zinc-600 transition hover:text-zinc-400"
        >
          <HealthDotsCompact services={health.services} overallStatus={health.overallStatus} />
          <span className="hidden sm:inline">{currentMode.shortLabel}</span>
          <span className="hidden text-zinc-700 sm:inline">&middot;</span>
          <span>{modelName}</span>
          {activeFile && (
            <>
              <span className="text-zinc-700">&middot;</span>
              <span className="hidden sm:inline capitalize">{activeFile.language}</span>
              <span className="text-zinc-700">&middot;</span>
              <span>Ln {cursorLine}, Col {cursorCol}</span>
              <span className="text-zinc-700">&middot;</span>
              <span className="hidden sm:inline">UTF-8</span>
            </>
          )}
          {!activeFile && (
            <>
              <span className="text-zinc-700">&middot;</span>
              <span className="hidden sm:inline">{sessionType}</span>
            </>
          )}
          <span className="text-zinc-700">&middot;</span>
          <span className="text-zinc-500">AI <span className={wsConnected ? 'text-green-500' : 'text-zinc-600'}>&bull;</span></span>
          {wsConnected && <span className="text-zinc-600">WS</span>}
          {gitBranch && (
            <>
              <span className="text-zinc-700">&middot;</span>
              <span className="text-orange-400">{gitBranch}{gitAhead > 0 ? ` ↑${gitAhead}` : ''}</span>
            </>
          )}
          {previewPort && (
            <>
              <span className="text-zinc-700">&middot;</span>
              <span className="text-green-500">Preview :{previewPort}</span>
            </>
          )}
        </button>
      </div>

      {showPopover && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
            aria-label="Fechar diagnostico"
          />
          <div className="app-popover absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-[1.1rem] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Diagnostico</p>
            <div className="mb-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Versao</span>
                <span className="text-zinc-300">Aura {version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Modo</span>
                <span className="text-zinc-300">{currentMode.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">API</span>
                <span className="truncate pl-4 text-zinc-300">{clientEnv.apiUrl || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">WebSocket</span>
                <span className={wsConnected ? 'text-green-400' : 'text-zinc-500'}>
                  {wsConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Servicos</p>
              <HealthPanel
                services={health.services}
                overallStatus={health.overallStatus}
                uptimeSeconds={health.uptimeSeconds}
                onRunDoctor={handleDoctor}
                doctorLoading={doctorLoading}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
