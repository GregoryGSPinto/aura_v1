'use client';

import { LoaderCircle, Mic, X } from 'lucide-react';

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
  if (!transcript && !isListening && !isProcessingVoice) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2 md:px-8">
      <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-zinc-900 px-3 py-2.5">
        <div className="mt-0.5">
          {isProcessingVoice ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-400" />
          ) : (
            <Mic className="h-4 w-4 text-red-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {isProcessingVoice ? 'Processando...' : isListening ? 'Escutando' : 'Transcricao'}
          </p>
          <p className="mt-1 text-sm text-zinc-300">{transcript || 'Aguardando fala...'}</p>
        </div>
        {!isProcessingVoice && !isListening && (
          <button
            type="button"
            onClick={onClear}
            className="rounded p-1 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
            aria-label="Limpar transcricao"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
