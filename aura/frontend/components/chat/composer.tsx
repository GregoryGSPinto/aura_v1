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

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    const maxHeight = 72;
    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  return (
    <div className="sticky bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
      <div className="composer-shell mx-auto max-w-[56rem] rounded-[1.9rem] p-3 sm:p-3.5">
        <AttachmentControls attachments={attachments} onRemove={onRemoveAttachment} />

        <div className="mt-1 flex items-end gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <AttachmentButton onClick={onAttach} />
          </div>

          <div className="composer-input-shell min-w-0 flex-1 rounded-[1.5rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_88%,transparent)] px-4 py-3 transition-[border-color,box-shadow] duration-200">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fg-subtle)]">
                {selectedModeLabel}
              </div>
              <div className="sm:hidden">
                <AttachmentButton onClick={onAttach} />
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Pergunte, dite ou peça uma análise operacional."
              className="min-h-[24px] max-h-[84px] w-full resize-none bg-transparent text-[15px] leading-7 text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)]"
              aria-label="Mensagem para Aura"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-h-[20px]">
                {error ? (
                  <p className={cn('text-xs text-[var(--danger)]')}>
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {error}
                    </span>
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || !hasContent}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[linear-gradient(135deg,var(--accent-primary-strong),var(--accent-secondary))] text-white shadow-[0_12px_26px_rgba(80,111,181,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar mensagem"
              >
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
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
