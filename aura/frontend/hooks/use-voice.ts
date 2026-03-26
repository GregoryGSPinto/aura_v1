'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceSTTState = 'idle' | 'recording' | 'processing' | 'error';
export type VoiceTTSState = 'idle' | 'loading' | 'playing';

// ---------------------------------------------------------------------------
// useVoiceTTS  — TTS via edge-tts backend (primary) ou Web SpeechSynthesis (fallback)
// ---------------------------------------------------------------------------

export function useVoiceTTS() {
  const [state, setState] = useState<VoiceTTSState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    setState('idle');
  }, []);

  // Speak using edge-tts backend → returns mp3 → HTMLAudioElement
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !text.trim()) return;

    stop();
    setState('loading');

    const base = clientEnv.apiUrl;
    const token = useAuthStore.getState().token;

    try {
      const res = await fetch(`${base}/api/v1/voice/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ text: text.slice(0, 1500) }),
      });

      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setState('playing');
      audio.onended = () => {
        setState('idle');
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onEnd?.();
      };
      audio.onerror = () => {
        setState('idle');
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onEnd?.();
        // Fallback to Web SpeechSynthesis
        _speakBrowser(text);
      };

      await audio.play();
    } catch {
      setState('idle');
      // Fallback to Web SpeechSynthesis when backend TTS is unavailable
      _speakBrowser(text, onEnd);
    }
  }, [stop]);

  // Fallback: browser SpeechSynthesis
  const _speakBrowser = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    utterance.onstart = () => setState('playing');
    utterance.onend = () => { setState('idle'); onEnd?.(); };
    utterance.onerror = () => { setState('idle'); onEnd?.(); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const isSpeaking = state === 'playing' || state === 'loading';

  return { state, isSpeaking, speak, stop };
}

// ---------------------------------------------------------------------------
// useVoiceSTT  — STT via Web Speech API (primary, works on iOS Safari + Chrome)
//               Falls back to MediaRecorder → backend Whisper
// ---------------------------------------------------------------------------

type SpeechRecognitionResult = { readonly [index: number]: { transcript: string }; isFinal?: boolean };
type SpeechRecognitionEvent = Event & { results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = Event & { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceSTT(onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceSTTState>('idle');
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setDuration(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // --- Web Speech API path (primary: no backend needed)
  const startWebSpeech = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results as ArrayLike<SpeechRecognitionResult>)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) onTranscript(transcript);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setState('error');
      cleanup();
      setState('idle');
    };
    rec.onend = () => {
      cleanup();
      setState('idle');
    };

    recognitionRef.current = rec;
    rec.start();
    setState('recording');

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [cleanup, onTranscript]);

  // --- MediaRecorder path (fallback: sends to backend Whisper)
  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus; Safari doesn't support it, fall back to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        setState('processing');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();

        try {
          const base = clientEnv.apiUrl;
          const token = useAuthStore.getState().token;
          const form = new FormData();
          form.append('file', blob, `recording.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`);
          const res = await fetch(`${base}/api/v1/voice/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
            body: form,
          });
          if (res.ok) {
            const data = await res.json();
            const text = data?.data?.transcript || data?.transcript || '';
            if (text) onTranscript(text);
          }
        } catch { /* silent */ }

        setState('idle');
      };

      recorder.start(250);
      setState('recording');
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setState('error');
      cleanup();
      setState('idle');
    }
  }, [cleanup, onTranscript]);

  const start = useCallback(() => {
    if (state !== 'idle') return;
    if (hasSpeechRecognition) {
      startWebSpeech();
    } else {
      startMediaRecorder();
    }
  }, [state, hasSpeechRecognition, startWebSpeech, startMediaRecorder]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setState('processing');
    }
  }, []);

  const toggle = useCallback(() => {
    if (state === 'idle') { start(); } else { stop(); }
  }, [state, start, stop]);

  return {
    state,
    duration,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    isActive: state !== 'idle',
    engine: hasSpeechRecognition ? 'web_speech' : 'media_recorder',
    start,
    stop,
    toggle,
  };
}

// ---------------------------------------------------------------------------
// useVoiceMode  — loop de conversa: Aura fala → mic ativa → Gregory fala → loop
// ---------------------------------------------------------------------------

export function useVoiceMode() {
  const [enabled, setEnabled] = useState(false);
  const [waitingForUser, setWaitingForUser] = useState(false);

  const enable = useCallback(() => setEnabled(true), []);
  const disable = useCallback(() => { setEnabled(false); setWaitingForUser(false); }, []);
  const toggle = useCallback(() => setEnabled((v) => !v), []);

  // Called after Aura finishes speaking — activate mic if mode is on
  const onAuraDoneSpeaking = useCallback((startListening: () => void) => {
    if (!enabled) return;
    setWaitingForUser(true);
    // Small delay so audio finishes before mic opens
    setTimeout(() => {
      setWaitingForUser(false);
      startListening();
    }, 400);
  }, [enabled]);

  return { enabled, waitingForUser, enable, disable, toggle, onAuraDoneSpeaking };
}

// ---------------------------------------------------------------------------
// useAudioPlayer  — plays a URL or base64 audio blob
// ---------------------------------------------------------------------------

export function useAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((src: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => { setPlaying(false); setCurrentTime(0); };
    audio.play().catch(() => setPlaying(false));
  }, []);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
  }, [playing]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) { audioRef.current.currentTime = time; }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  return { playing, currentTime, duration, play, toggle, seek, stop };
}
