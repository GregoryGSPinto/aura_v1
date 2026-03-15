'use client';

import { LoaderCircle, Mic, Waves, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export function VoiceTranscriptPanel({
  partialTranscript,
  finalTranscript,
  isListening,
  isProcessingVoice,
  onClear,
}: {
  partialTranscript: string;
  finalTranscript: string;
  isListening: boolean;
  isProcessingVoice: boolean;
  onClear: () => void;
}) {
  const transcript = [finalTranscript, partialTranscript].filter(Boolean).join(' ').trim();

  if (!transcript && !isListening && !isProcessingVoice) {
    return null;
  }

  return (
    <div className="shell-card rounded-[1.5rem] border-[color:color-mix(in_srgb,var(--accent-primary)_24%,var(--border-default))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--fg-secondary)]">
            {isProcessingVoice ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : isListening ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <Waves className="h-3.5 w-3.5" />
            )}
            {isProcessingVoice ? 'Processando voz' : isListening ? 'Escutando agora' : 'Transcricao capturada'}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--fg-primary)]">
            {transcript || 'Aguardando fala...'}
          </p>
        </div>

        {!isProcessingVoice ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] text-[var(--fg-secondary)] transition hover:text-[var(--fg-primary)]',
              isListening && 'pointer-events-none opacity-50',
            )}
            aria-label="Limpar transcricao de voz"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
