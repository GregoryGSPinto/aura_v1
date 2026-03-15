'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowUp, LoaderCircle } from 'lucide-react';

import type { AttachmentPreview } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { AttachmentButton, AttachmentControls } from '@/components/chat/attachment-controls';
import { VoiceControls } from '@/components/chat/voice-controls';

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttach,
  onRemoveAttachment,
  isLoading,
  isListening,
  isSpeaking,
  voiceReplyEnabled,
  onToggleListening,
  onStopSpeaking,
  onToggleVoiceReply,
  error,
  selectedModeLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  attachments: AttachmentPreview[];
  onAttach: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  isLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  voiceReplyEnabled: boolean;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  onToggleVoiceReply: () => void;
  error: string | null;
  selectedModeLabel: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasContent = Boolean(value.trim() || attachments.length);
  const lineHeight = 24;
  const maxRows = 4;
  const maxHeight = lineHeight * maxRows;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight, value]);

  return (
    <div className="sticky bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
      <div className="composer-shell mx-auto max-w-[56rem] rounded-[1.75rem] p-2.5 sm:p-3">
        <AttachmentControls attachments={attachments} onRemove={onRemoveAttachment} />

        <div className="mt-2 flex items-end gap-2 sm:gap-2.5">
          <div className="hidden shrink-0 self-end sm:block">
            <AttachmentButton onClick={onAttach} />
          </div>

          <div className="composer-input-shell min-w-0 flex-1 rounded-[1.4rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,transparent)] px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow] duration-200 sm:px-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_95%,transparent)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                {selectedModeLabel}
              </div>
              <div className="shrink-0 self-center sm:hidden">
                <AttachmentButton onClick={onAttach} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder="Pergunte, dite ou peça uma análise operacional."
                className="min-h-[24px] max-h-[96px] w-full resize-none overflow-y-hidden bg-transparent py-1 text-[15px] leading-6 text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)]"
                aria-label="Mensagem para Aura"
              />

              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || !hasContent}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-[0.95rem] border border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[linear-gradient(135deg,var(--accent-primary-strong),var(--accent-secondary))] text-white shadow-[0_10px_20px_rgba(80,111,181,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar mensagem"
              >
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-2 flex min-h-[18px] items-center justify-between gap-3">
              <div className="min-h-[18px]">
                {error ? (
                  <p className={cn('text-xs text-[var(--danger)]')}>
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {error}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="text-[11px] text-[var(--fg-subtle)]">{hasContent ? 'Enter envia' : 'Shift + Enter quebra linha'}</div>
            </div>
          </div>

          <VoiceControls
            isListening={isListening}
            isSpeaking={isSpeaking}
            voiceReplyEnabled={voiceReplyEnabled}
            onToggleListening={onToggleListening}
            onStopSpeaking={onStopSpeaking}
            onToggleVoiceReply={onToggleVoiceReply}
          />
        </div>
      </div>
    </div>
  );
}
