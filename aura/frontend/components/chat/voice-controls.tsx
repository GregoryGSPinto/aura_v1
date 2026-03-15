'use client';

import { Mic, MicOff, Volume2, VolumeX, Waves } from 'lucide-react';

import { cn } from '@/lib/utils';

export function VoiceControls({
  isListening,
  isSpeaking,
  voiceReplyEnabled,
  onToggleListening,
  onStopSpeaking,
  onToggleVoiceReply,
}: {
  isListening: boolean;
  isSpeaking: boolean;
  voiceReplyEnabled: boolean;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  onToggleVoiceReply: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleListening}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border transition-[background,border-color,color] duration-200',
          isListening
            ? 'border-red-400/30 bg-red-400/10 text-red-300'
            : 'border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]',
        )}
        aria-label={isListening ? 'Parar gravacao' : 'Iniciar gravacao'}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={isSpeaking ? onStopSpeaking : onToggleVoiceReply}
        className={cn(
          'hidden h-11 items-center gap-2 rounded-[1rem] border px-3 text-sm transition-[background,border-color,color] duration-200 sm:inline-flex',
          isSpeaking
            ? 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--text-primary)]'
            : voiceReplyEnabled
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]',
        )}
        aria-label={isSpeaking ? 'Parar leitura em audio' : 'Alternar resposta por voz'}
      >
        {isSpeaking ? <VolumeX className="h-4 w-4" /> : voiceReplyEnabled ? <Waves className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {isSpeaking ? 'Parar audio' : voiceReplyEnabled ? 'Voz ligada' : 'Voz desligada'}
      </button>
    </div>
  );
}
