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
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/8 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-subtle)]">{label}</p>
          <p className="truncate pt-1 text-sm text-[var(--text-primary)]">{value}</p>
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
    <div className="rounded-[30px] border border-white/10 bg-[rgba(9,14,23,0.88)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
      <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-subtle)]">Aura</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">Painel da Aura</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Modos, saude da stack e acoes rapidas para a sessao atual.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          {researchMode ? <Search className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          {researchMode ? 'Modo de pesquisa preparado' : 'Modo conversacional premium'}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Estado do sistema</p>
        <StatusRow label="Backend" value={backendOnline ? 'Online' : 'Offline'} active={backendOnline} icon={Cloud} />
        <StatusRow label="Voz" value={voiceReady ? (isListening ? 'Escutando' : isSpeaking ? 'Falando' : 'Pronta') : 'Indisponivel'} active={voiceReady} icon={Mic} />
        <StatusRow label="Modelo atual" value={runtimeStatus?.model ?? selectedMode.label} active={Boolean(runtimeStatus?.model)} icon={Bot} />
        <StatusRow label="Modo atual" value={selectedMode.label} active={true} icon={researchMode ? Search : Activity} />
      </div>

      <div className="mt-5">
        <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={onSelectMode} />
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Acoes rapidas</p>
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
            'flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left transition',
            voiceReplyEnabled
              ? 'border-emerald-400/20 bg-emerald-400/10 text-[var(--text-primary)]'
              : 'border-white/10 bg-white/[0.03] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]',
          )}
        >
          <div>
            <p className="text-sm font-medium">Resposta por voz</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Entrada por audio sempre prioriza playback falado.
            </p>
          </div>
          <Waves className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Contexto da sessao</p>
        <p className="mt-3 text-sm text-[var(--text-primary)]">{selectedMode.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{selectedMode.description}</p>
      </div>
    </div>
  );
}
