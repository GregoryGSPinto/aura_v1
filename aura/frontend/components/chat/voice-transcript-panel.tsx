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
    <div className="rounded-[24px] border border-[var(--border-strong)]/60 bg-[linear-gradient(180deg,rgba(15,22,34,0.96),rgba(10,15,24,0.9))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            {isProcessingVoice ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : isListening ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <Waves className="h-3.5 w-3.5" />
            )}
            {isProcessingVoice ? 'Processando voz' : isListening ? 'Escutando agora' : 'Transcricao capturada'}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--text-primary)]">
            {transcript || 'Aguardando fala...'}
          </p>
        </div>

        {!isProcessingVoice ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--text-secondary)] transition hover:bg-white/[0.08] hover:text-[var(--text-primary)]',
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
