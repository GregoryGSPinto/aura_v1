'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowUp, LoaderCircle, Paperclip } from 'lucide-react';

import type { AttachmentPreview } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { AttachmentControls } from '@/components/chat/attachment-controls';
import { SlashCommandMenu } from '@/components/chat/slash-command-menu';
import { VoiceButton, VoiceModeToggle } from '@/components/voice/voice-recorder';

export function ChatComposer({ value, onChange, onSubmit, attachments, onAttach, onRemoveAttachment, isLoading, isListening, onToggleListening, error, selectedModeLabel, isSpeaking, voiceReplyEnabled, onStopSpeaking, onToggleVoiceReply, onVoiceTranscript, voiceModeWaiting }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  attachments: AttachmentPreview[];
  onAttach: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  isLoading: boolean;
  isListening: boolean;
  isSpeaking?: boolean;
  voiceReplyEnabled?: boolean;
  voiceModeWaiting?: boolean;
  onToggleListening: () => void;
  onStopSpeaking?: () => void;
  onToggleVoiceReply?: () => void;
  /** Called when VoiceButton transcribes audio — fills the composer */
  onVoiceTranscript?: (text: string) => void;
  error: string | null;
  selectedModeLabel: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasContent = Boolean(value.trim() || attachments.length);
  const maxHeight = 24 * 6; // 6 lines max

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight, value]);

  const placeholderMap: Record<string, string> = {
    'Aura Pesquisa': 'Pesquise algo...',
    'Aura Profunda': 'Modo profundo ativo...',
  };

  const placeholder = placeholderMap[selectedModeLabel] ?? 'Fale com a Aura...';
  const brainOverride = value.startsWith('@local ') ? 'local' : value.startsWith('@cloud ') ? 'cloud' : null;

  return (
    <div className="shrink-0 border-t border-white/[0.06] glass pb-[calc(env(safe-area-inset-bottom,0px)+0.875rem)] pt-3">
      <div className="mx-auto w-full xl:px-2 2xl:px-3">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-2">
            <AttachmentControls attachments={attachments} onRemove={onRemoveAttachment} />
          </div>
        )}

        {/* Input Row */}
        <div className="relative flex items-end gap-2 rounded-[1.25rem] border border-white/8 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,var(--bg-surface))] px-3 py-2 shadow-[0_-12px_32px_rgba(0,0,0,0.18)] transition-colors focus-within:border-white/12">
          {/* Slash command menu */}
          <SlashCommandMenu
            inputValue={value}
            visible={value.startsWith('/') && !value.includes(' ')}
            onSelect={(cmd) => {
              if (cmd) {
                onChange(cmd + ' ');
              } else {
                onChange('');
              }
            }}
          />
          {/* Mic button — VoiceButton handles Web Speech API + MediaRecorder */}
          <VoiceButton
            onTranscript={(text) => {
              if (onVoiceTranscript) {
                onVoiceTranscript(text);
              } else {
                onChange(value ? `${value} ${text}` : text);
              }
            }}
            compact
            disabled={isLoading}
          />

          {/* Brain override indicator */}
          {brainOverride && (
            <span className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
              brainOverride === 'cloud' ? 'bg-blue-900/30 text-blue-400' : 'bg-emerald-900/30 text-emerald-400',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', brainOverride === 'cloud' ? 'bg-blue-400' : 'bg-emerald-400')} />
              {brainOverride}
            </span>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            className="min-h-[24px] w-full resize-none bg-transparent py-1.5 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
            aria-label="Mensagem para Aura"
          />

          {/* Voice Mode Toggle */}
          {onToggleVoiceReply && (
            <VoiceModeToggle
              enabled={!!voiceReplyEnabled}
              onToggle={onToggleVoiceReply}
              isSpeaking={isSpeaking}
              waitingForUser={voiceModeWaiting}
            />
          )}

          {/* Attach */}
          <button
            type="button"
            onClick={onAttach}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || !hasContent}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--aura-green)] text-[var(--aura-dark)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Enviar mensagem"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
