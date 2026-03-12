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
  statusLabel,
  error,
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
  statusLabel: string;
  error: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <div className="sticky bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
      <div className="mx-auto max-w-4xl rounded-[30px] border border-white/10 bg-[rgba(9,14,23,0.9)] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
        <AttachmentControls attachments={attachments} onRemove={onRemoveAttachment} />

        <div className="mt-3 flex items-end gap-3">
          <AttachmentButton onClick={onAttach} />

          <div className="min-w-0 flex-1 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
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
              placeholder="Peça contexto, ações seguras, leitura operacional ou análise de anexos."
              className="max-h-[220px] min-h-[28px] w-full resize-none bg-transparent text-sm leading-7 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] sm:text-[15px]"
              aria-label="Mensagem para Aura"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={cn('text-xs text-[var(--text-muted)]', error && 'text-[var(--error)]')}>
                {error ? (
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {error}
                  </span>
                ) : (
                  statusLabel
                )}
              </p>

              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || (!value.trim() && !attachments.length)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#91ddff,#7786ff)] text-[#06101b] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
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
