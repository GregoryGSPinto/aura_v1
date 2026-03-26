'use client';

/**
 * Voice components:
 *  - VoiceButton   — mic hold-to-record, Web Speech API primary, pulse animation
 *  - AudioPlayer   — WhatsApp-style inline player for assistant messages
 *  - VoiceModeToggle — toggle loop conversa (Aura fala → mic ativa → loop)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Pause, Play, Volume2, VolumeX, Waves } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useVoiceSTT } from '@/hooks/use-voice';

// ---------------------------------------------------------------------------
// VoiceButton
// ---------------------------------------------------------------------------

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  /** compact = small icon-only button for the composer */
  compact?: boolean;
  disabled?: boolean;
}

export function VoiceButton({ onTranscript, compact = true, disabled }: VoiceButtonProps) {
  const { state, duration, isRecording, isProcessing, toggle } = useVoiceSTT(onTranscript);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || isProcessing}
        className={cn(
          'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          isRecording
            ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
            : isProcessing
              ? 'text-zinc-500'
              : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-400',
          disabled && 'pointer-events-none opacity-40',
        )}
        aria-label={isRecording ? 'Parar gravação' : isProcessing ? 'Transcrevendo...' : 'Gravar voz'}
      >
        {/* Pulse ring while recording */}
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-lg bg-red-500/20" />
        )}
        {isProcessing ? (
          <Loader2 className="relative h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="relative h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
    );
  }

  // Full size variant (e.g. modal or voice mode panel)
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || isProcessing}
        className={cn(
          'relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200',
          isRecording
            ? 'bg-red-500 text-white shadow-xl shadow-red-500/40'
            : isProcessing
              ? 'bg-zinc-800 text-zinc-500'
              : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95',
          disabled && 'pointer-events-none opacity-40',
        )}
        aria-label={isRecording ? 'Soltar para transcrever' : 'Segurar para gravar'}
      >
        {/* Outer pulse */}
        {isRecording && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
            <span className="absolute -inset-3 animate-pulse rounded-full bg-red-500/10" />
          </>
        )}
        {isProcessing ? (
          <Loader2 className="relative h-7 w-7 animate-spin" />
        ) : isRecording ? (
          <MicOff className="relative h-7 w-7" />
        ) : (
          <Mic className="h-7 w-7" />
        )}
      </button>

      <div className="h-5 text-center text-xs text-zinc-500">
        {isRecording && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono">{fmt(duration)}</span>
          </span>
        )}
        {isProcessing && <span>Transcrevendo...</span>}
        {state === 'idle' && <span>Toque para falar</span>}
        {state === 'error' && <span className="text-red-400">Erro de microfone</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AudioPlayer  — WhatsApp-style inline player
// ---------------------------------------------------------------------------

interface AudioPlayerProps {
  /** URL or base64 data URL */
  src: string;
  /** Auto-play when mounted */
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({ src, autoPlay, onEnded, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => { setTotalDuration(audio.duration); setLoading(false); };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => { setPlaying(false); setCurrentTime(0); onEnded?.(); };
    audio.onerror = () => setLoading(false);

    if (autoPlay) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src, autoPlay, onEnded]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
  };

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!audioRef.current || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * totalDuration;
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2', className)}>
      {/* Play / Pause */}
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-white/20 disabled:opacity-40"
        aria-label={playing ? 'Pausar' : 'Reproduzir'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex flex-1 flex-col gap-1">
        <div
          className="relative h-1 w-full cursor-pointer rounded-full bg-white/10"
          onPointerDown={seek}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-blue-400 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          {/* Scrubber dot */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(totalDuration)}</span>
        </div>
      </div>

      {/* Wave icon */}
      <Waves className={cn('h-4 w-4 shrink-0 text-zinc-600', playing && 'animate-pulse text-blue-400')} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoiceModeToggle  — toggle de modo conversa no composer
// ---------------------------------------------------------------------------

interface VoiceModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
  isSpeaking?: boolean;
  waitingForUser?: boolean;
}

export function VoiceModeToggle({ enabled, onToggle, isSpeaking, waitingForUser }: VoiceModeToggleProps) {
  const statusLabel = isSpeaking
    ? 'Aura falando...'
    : waitingForUser
      ? 'Aguardando você...'
      : enabled
        ? 'Modo voz ativo'
        : 'Modo voz';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'hidden h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all duration-200 sm:inline-flex',
        enabled
          ? isSpeaking
            ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
            : waitingForUser
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
          : 'border-white/8 bg-white/4 text-zinc-600 hover:border-white/12 hover:text-zinc-400',
      )}
      aria-label={enabled ? 'Desativar modo voz' : 'Ativar modo voz'}
      aria-pressed={enabled}
    >
      {enabled ? (
        isSpeaking ? (
          <Volume2 className="h-3.5 w-3.5 animate-pulse" />
        ) : waitingForUser ? (
          <Mic className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Waves className="h-3.5 w-3.5" />
        )
      ) : (
        <VolumeX className="h-3.5 w-3.5" />
      )}
      <span>{statusLabel}</span>
    </button>
  );
}
