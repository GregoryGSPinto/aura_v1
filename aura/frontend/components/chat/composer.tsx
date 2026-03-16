'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowUp, LoaderCircle, Mic, MicOff, Paperclip } from 'lucide-react';

import type { AttachmentPreview } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { AttachmentControls } from '@/components/chat/attachment-controls';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChatComposer({ value, onChange, onSubmit, attachments, onAttach, onRemoveAttachment, isLoading, isListening, onToggleListening, error, selectedModeLabel, isSpeaking, voiceReplyEnabled, onStopSpeaking, onToggleVoiceReply }: {
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
  onToggleListening: () => void;
  onStopSpeaking?: () => void;
  onToggleVoiceReply?: () => void;
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

  const placeholder = placeholderMap[selectedModeLabel] ?? 'Converse com Aura...';

  return (
    <div className="sticky bottom-0 z-20 border-t border-white/5 bg-zinc-950 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-3 px-4 md:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-2">
            <AttachmentControls attachments={attachments} onRemove={onRemoveAttachment} />
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2 rounded-xl border border-white/5 bg-zinc-900 px-3 py-2 transition-colors focus-within:border-white/10">
          {/* Mic button */}
          <button
            type="button"
            onClick={onToggleListening}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
              isListening
                ? 'bg-red-500/10 text-red-400'
                : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-400',
            )}
            aria-label={isListening ? 'Parar gravacao' : 'Iniciar gravacao'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

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
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
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
