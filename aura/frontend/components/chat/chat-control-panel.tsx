'use client';

import { Activity, AudioLines, Bot, Cloud, Mic, Plus, RefreshCcw, Search, Trash2, Waves } from 'lucide-react';

import { ChatModeSelector } from '@/components/chat/mode-selector';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { getAuraChatMode, type AuraChatModeId } from '@/lib/chat-modes';
import { cn } from '@/lib/utils';

function statusTone(active: boolean) {
  return active ? 'bg-emerald-400' : 'bg-amber-400';
}

function StatusRow({
  label,
  value,
  active,
  icon: Icon,
}: {
  label: string;
  value: string;
  active: boolean;
  icon: typeof Cloud;
}) {
  return (
    <div className="shell-card flex items-center justify-between gap-3 rounded-[1.2rem] px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)]">
          <Icon className="h-4 w-4 text-[var(--fg-secondary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-subtle)]">{label}</p>
          <p className="truncate pt-1 text-sm text-[var(--fg-primary)]">{value}</p>
        </div>
      </div>
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusTone(active))} />
    </div>
  );
}

export function ChatControlPanel({
  selectedModeId,
  onSelectMode,
  onNewChat,
  onClearChat,
  onRefresh,
  onToggleVoiceReply,
  onTestVoice,
  voiceReplyEnabled,
  isListening,
  isSpeaking,
}: {
  selectedModeId: AuraChatModeId;
  onSelectMode: (modeId: AuraChatModeId) => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onRefresh: () => void;
  onToggleVoiceReply: () => void;
  onTestVoice: () => void;
  voiceReplyEnabled: boolean;
  isListening: boolean;
  isSpeaking: boolean;
}) {
  const { runtimeStatus, voiceStatus } = useAuraPreferences();
  const selectedMode = getAuraChatMode(selectedModeId);
  const backendOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const voiceReady = Boolean(voiceStatus?.pipeline_ready || (voiceStatus?.stt_ready && voiceStatus?.tts_ready));
  const researchMode = selectedMode.capability === 'research';

  return (
    <div className="shell-panel rounded-[2rem] p-4">
      <div className="shell-card rounded-[1.6rem] p-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fg-subtle)]">Aura</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--fg-primary)]">Painel de sessao</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
          Modos, saude da stack e acoes rapidas para a sessao atual.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_96%,transparent)] px-3 py-1.5 text-xs text-[var(--fg-secondary)]">
          {researchMode ? <Search className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          {researchMode ? 'Modo de pesquisa preparado' : 'Modo conversacional premium'}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Estado do sistema</p>
        <StatusRow label="Backend" value={backendOnline ? 'Online' : 'Offline'} active={backendOnline} icon={Cloud} />
        <StatusRow label="Voz" value={voiceReady ? (isListening ? 'Escutando' : isSpeaking ? 'Falando' : 'Pronta') : 'Indisponivel'} active={voiceReady} icon={Mic} />
        <StatusRow label="Modelo atual" value={runtimeStatus?.model ?? selectedMode.label} active={Boolean(runtimeStatus?.model)} icon={Bot} />
        <StatusRow label="Modo atual" value={selectedMode.label} active={true} icon={researchMode ? Search : Activity} />
      </div>

      <div className="mt-5">
        <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={onSelectMode} />
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Acoes rapidas</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" className="h-11 justify-start rounded-[18px]" onClick={onNewChat}>
            <Plus className="h-4 w-4" />
            Novo chat
          </Button>
          <Button type="button" variant="secondary" className="h-11 justify-start rounded-[18px]" onClick={onClearChat}>
            <Trash2 className="h-4 w-4" />
            Limpar
          </Button>
          <Button type="button" variant="secondary" className="h-11 justify-start rounded-[18px]" onClick={onTestVoice}>
            <AudioLines className="h-4 w-4" />
            Testar voz
          </Button>
          <Button type="button" variant="secondary" className="h-11 justify-start rounded-[18px]" onClick={onRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Healthcheck
          </Button>
        </div>
        <button
          type="button"
          onClick={onToggleVoiceReply}
          className={cn(
            'flex w-full items-center justify-between rounded-[1.2rem] border px-3 py-3 text-left transition-[background,border-color,color] duration-200',
            voiceReplyEnabled
              ? 'border-emerald-400/22 bg-emerald-400/10 text-[var(--fg-primary)]'
              : 'border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_96%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-default)] hover:text-[var(--fg-primary)]',
          )}
        >
          <div>
            <p className="text-sm font-medium">Resposta por voz</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Entrada por audio sempre prioriza playback falado.
            </p>
          </div>
          <Waves className="h-4 w-4" />
        </button>
      </div>

      <div className="shell-card mt-5 rounded-[1.5rem] p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Contexto da sessao</p>
        <p className="mt-3 text-sm text-[var(--fg-primary)]">{selectedMode.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">{selectedMode.description}</p>
      </div>
    </div>
  );
}
