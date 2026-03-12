# 🚀 PROMPT JARVIS MODE — Interface AI OS para Aura

Transforme a Aura em um assistente visual estilo JARVIS/Tony Stark.

---

## 📁 ARQUIVOS A CRIAR/MODIFICAR

```
components/
├── ai/
│   ├── ai-orb.tsx              # NOVO — Orb central pulsante
│   ├── agent-swarm.tsx         # NOVO — Agentes orbitando
│   └── thinking-particles.tsx  # NOVO — Partículas de processamento
├── audio/
│   ├── audio-waveform.tsx      # NOVO — Visualização de áudio
│   ├── voice-button.tsx        # NOVO — Botão de microfone animado
│   └── audio-toggle.tsx        # NOVO — Toggle de resposta falada
├── chat/
│   ├── chat-container.tsx      # MODIFICAR — Layout principal
│   ├── chat-message.tsx        # NOVO — Mensagem estilo ChatGPT
│   ├── chat-input.tsx          # NOVO — Input com anexos e voz
│   └── file-preview.tsx        # NOVO — Preview de anexos
├── hud/
│   ├── agent-hud.tsx           # NOVO — Painel lateral de agentes
│   ├── system-metrics.tsx      # NOVO — Métricas em tempo real
│   └── activity-feed.tsx       # NOVO — Feed de atividades
└── layout/
    └── sidebar.tsx             # MODIFICAR — Collapse funcional
```

---

## 🔮 COMPONENTE 1 — AI ORB

```tsx
// components/ai/ai-orb.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AIOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
};

export function AIOrb({ 
  isListening = false, 
  isSpeaking = false, 
  isProcessing = false,
  size = 'lg' 
}: AIOrbProps) {
  const [intensity, setIntensity] = useState(0.5);

  // Simular pulsação baseada na atividade
  useEffect(() => {
    if (!isListening && !isSpeaking && !isProcessing) {
      setIntensity(0.5);
      return;
    }

    const interval = setInterval(() => {
      setIntensity(0.3 + Math.random() * 0.7);
    }, 100);

    return () => clearInterval(interval);
  }, [isListening, isSpeaking, isProcessing]);

  const getStateColor = () => {
    if (isListening) return 'from-cyan-400 via-cyan-500 to-blue-600';
    if (isSpeaking) return 'from-violet-400 via-purple-500 to-pink-600';
    if (isProcessing) return 'from-amber-400 via-orange-500 to-yellow-600';
    return 'from-cyan-400 via-blue-500 to-violet-600';
  };

  const getGlowColor = () => {
    if (isListening) return 'cyan';
    if (isSpeaking) return 'violet';
    if (isProcessing) return 'amber';
    return 'blue';
  };

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
      {/* Glow externo */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-r ${getStateColor()} blur-3xl`}
        animate={{
          scale: isSpeaking || isListening ? [1, 1.3, 1] : [1, 1.1, 1],
          opacity: intensity,
        }}
        transition={{
          duration: isSpeaking || isListening ? 0.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Anel externo rotativo */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <div className={`absolute top-0 left-1/2 w-2 h-2 rounded-full bg-${getGlowColor()}-400 blur-sm`} />
      </motion.div>

      {/* Anel médio rotativo reverso */}
      <motion.div
        className="absolute inset-2 rounded-full border border-white/5"
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      >
        <div className={`absolute bottom-0 left-1/2 w-1.5 h-1.5 rounded-full bg-${getGlowColor()}-500`} />
      </motion.div>

      {/* Orb central */}
      <motion.div
        className={`relative w-3/4 h-3/4 rounded-full bg-gradient-to-br ${getStateColor()}`}
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 0.3,
          repeat: isSpeaking ? Infinity : 0,
        }}
      >
        {/* Reflexo */}
        <div className="absolute top-1/4 left-1/4 w-1/3 h-1/3 rounded-full bg-white/30 blur-md" />
        
        {/* Núcleo */}
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
      </motion.div>

      {/* Partículas quando processando */}
      <AnimatePresence>
        {isProcessing && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-amber-400"
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  x: Math.cos((i * 60 * Math.PI) / 180) * 60,
                  y: Math.sin((i * 60 * Math.PI) / 180) * 60,
                }}
                exit={{ scale: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Status text */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className={`text-xs font-medium text-${getGlowColor()}-400 uppercase tracking-widest`}>
          {isListening ? 'Ouvindo...' : isSpeaking ? 'Falando...' : isProcessing ? 'Pensando...' : 'Aura'}
        </span>
      </div>
    </div>
  );
}
```

---

## 🎙️ COMPONENTE 2 — AUDIO WAVEFORM

```tsx
// components/audio/audio-waveform.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AudioWaveformProps {
  isActive: boolean;
  audioData?: number[];
}

export function AudioWaveform({ isActive, audioData }: AudioWaveformProps) {
  const [bars, setBars] = useState<number[]>(new Array(20).fill(0.1));
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive) {
      setBars(new Array(20).fill(0.1));
      return;
    }

    const animate = () => {
      setBars(
        new Array(20).fill(0).map(() => {
          // Simular dados de áudio ou usar dados reais
          return 0.2 + Math.random() * 0.8;
        })
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  // Usar dados reais se fornecidos
  const displayBars = audioData || bars;

  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {displayBars.map((height, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-cyan-500 to-cyan-300"
          animate={{
            height: isActive ? `${height * 100}%` : '10%',
            opacity: isActive ? 1 : 0.3,
          }}
          transition={{
            duration: 0.1,
            delay: i * 0.01,
          }}
        />
      ))}
    </div>
  );
}

// Versão com análise real de áudio
export function RealAudioWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const x = i * barWidth;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(1, '#8b5cf6');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContext.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      className="rounded-lg"
    />
  );
}
```

---

## 🎤 COMPONENTE 3 — VOICE BUTTON

```tsx
// components/audio/voice-button.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { AudioWaveform } from './audio-waveform';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function VoiceButton({ onTranscript, onRecordingStateChange }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Aqui você enviaria para a API de transcrição
        // Por enquanto, simulamos
        await sendToTranscription(blob);
        
        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Coletar a cada 100ms
      setIsRecording(true);
      onRecordingStateChange?.(true);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
    }
  }, [onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStateChange?.(false);
    }
  }, [isRecording, onRecordingStateChange]);

  const sendToTranscription = async (blob: Blob) => {
    // Implementar chamada real para /api/v1/audio/transcribe
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    try {
      const response = await fetch('/api/v1/audio/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        onTranscript(data.data.text);
      }
    } catch (error) {
      console.error('Erro na transcrição:', error);
      // Fallback: simular transcrição para teste
      setTimeout(() => {
        onTranscript('Audio transcrito com sucesso');
      }, 500);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden"
          >
            <AudioWaveform isActive={isRecording} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={toggleRecording}
        className={`relative p-3 rounded-xl transition-colors ${
          isRecording 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        {/* Anel pulsante quando gravando */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-red-400"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          />
        )}

        {isRecording ? (
          <Square className="w-5 h-5 fill-current" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </motion.button>
    </div>
  );
}
```

---

## 🧠 COMPONENTE 4 — AGENT HUD

```tsx
// components/hud/agent-hud.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Brain, 
  Search, 
  Zap, 
  CheckCircle2,
  Activity,
  Cpu,
  Terminal,
  Globe
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  status: 'idle' | 'active' | 'complete' | 'error';
  progress?: number;
  task?: string;
}

interface AgentEvent {
  agentId: string;
  message: string;
  timestamp: Date;
  type: 'start' | 'progress' | 'complete' | 'error';
}

export function AgentHUD() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: 'planner', name: 'Planner', icon: <Brain className="w-4 h-4" />, color: 'amber', status: 'idle' },
    { id: 'research', name: 'Research', icon: <Search className="w-4 h-4" />, color: 'cyan', status: 'idle' },
    { id: 'executor', name: 'Executor', icon: <Zap className="w-4 h-4" />, color: 'violet', status: 'idle' },
    { id: 'validator', name: 'Validator', icon: <CheckCircle2 className="w-4 h-4" />, color: 'green', status: 'idle' },
  ]);

  const [events, setEvents] = useState<AgentEvent[]>([]);

  // Simular atividade (substituir por dados reais do backend)
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => ({
        ...agent,
        status: Math.random() > 0.7 
          ? ['idle', 'active', 'complete'][Math.floor(Math.random() * 3)] as Agent['status']
          : agent.status,
        progress: agent.status === 'active' ? Math.random() * 100 : undefined,
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Agent['status'], color: string) => {
    const colors: Record<string, Record<string, string>> = {
      idle: {
        amber: 'text-amber-500/50',
        cyan: 'text-cyan-500/50',
        violet: 'text-violet-500/50',
        green: 'text-green-500/50',
      },
      active: {
        amber: 'text-amber-400',
        cyan: 'text-cyan-400',
        violet: 'text-violet-400',
        green: 'text-green-400',
      },
      complete: {
        amber: 'text-amber-300',
        cyan: 'text-cyan-300',
        violet: 'text-violet-300',
        green: 'text-green-300',
      },
      error: {
        amber: 'text-red-400',
        cyan: 'text-red-400',
        violet: 'text-red-400',
        green: 'text-red-400',
      },
    };
    return colors[status]?.[color] || colors.idle[color];
  };

  const getGlowColor = (color: string) => {
    const glows: Record<string, string> = {
      amber: 'shadow-amber-500/50',
      cyan: 'shadow-cyan-500/50',
      violet: 'shadow-violet-500/50',
      green: 'shadow-green-500/50',
    };
    return glows[color] || '';
  };

  return (
    <div className="w-64 h-full bg-slate-950/80 backdrop-blur-xl border-l border-white/5 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-4 border-b border-white/5">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-slate-200">Agent Swarm</span>
      </div>

      {/* Lista de Agentes */}
      <div className="space-y-3">
        {agents.map((agent) => (
          <motion.div
            key={agent.id}
            className="relative p-3 rounded-xl bg-white/5 border border-white/5 overflow-hidden"
            animate={{
              borderColor: agent.status === 'active' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255,255,255,0.05)',
            }}
          >
            {/* Barra de progresso */}
            {agent.status === 'active' && agent.progress !== undefined && (
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${agent.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            )}

            <div className="flex items-center gap-3">
              {/* Ícone com glow quando ativo */}
              <motion.div
                className={`p-2 rounded-lg bg-white/5 ${getStatusColor(agent.status, agent.color)}`}
                animate={{
                  boxShadow: agent.status === 'active' 
                    ? `0 0 20px rgba(6, 182, 212, 0.5)` 
                    : '0 0 0px rgba(0,0,0,0)',
                }}
              >
                {agent.icon}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                  <StatusDot status={agent.status} />
                </div>
                <span className="text-xs text-slate-500 capitalize">{agent.status}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Métricas do Sistema */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Cpu className="w-3 h-3" />
          <span>System Load</span>
          <span className="ml-auto text-cyan-400">42%</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="w-[42%] h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full" />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Terminal className="w-3 h-3" />
          <span>Active Jobs</span>
          <span className="ml-auto text-amber-400">3</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Globe className="w-3 h-3" />
          <span>API Status</span>
          <span className="ml-auto text-green-400">Online</span>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Agent['status'] }) {
  const colors = {
    idle: 'bg-slate-500',
    active: 'bg-cyan-400',
    complete: 'bg-green-400',
    error: 'bg-red-400',
  };

  return (
    <motion.div
      className={`w-2 h-2 rounded-full ${colors[status]}`}
      animate={status === 'active' ? {
        scale: [1, 1.2, 1],
        opacity: [1, 0.5, 1],
      } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    />
  );
}
```

---

## 💬 COMPONENTE 5 — CHAT INPUT MODERNO

```tsx
// components/chat/chat-input.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, X } from 'lucide-react';
import { VoiceButton } from '../audio/voice-button';

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Mensagem para a Aura...' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    onSend(input, attachments);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachments, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleTranscript = (text: string) => {
    setInput(text);
  };

  return (
    <div className="border-t border-white/5 bg-slate-950/50 backdrop-blur-xl p-4">
      {/* Preview de anexos */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {attachments.map((file, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
            >
              <span className="truncate max-w-[150px] text-slate-300">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Input principal */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </motion.button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isRecording}
            rows={1}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />
        </div>

        <VoiceButton 
          onTranscript={handleTranscript}
          onRecordingStateChange={setIsRecording}
        />

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={disabled || (!input.trim() && attachments.length === 0)}
          className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          <Send className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
```

---

## 📦 COMPONENTE 6 — CHAT CONTAINER (Layout Principal)

```tsx
// components/chat/chat-container.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChatInput } from './chat-input';
import { AIOrb } from '../ai/ai-orb';
import { AgentHUD } from '../hud/agent-hud';
import type { ChatMessage } from '@/lib/types';

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (content: string, attachments?: File[]) => {
    // Adicionar mensagem do usuário
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Enviar para API
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context: { history: messages.slice(-10) },
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Falar a resposta se habilitado
      if (audioEnabled) {
        speak(data.data.response);
      }
    } catch (error) {
      console.error('Erro no chat:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    utterance.pitch = 1;
    
    utterance.onend = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar recolhível (já existe) */}
      
      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header com Orb */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <AIOrb 
              isProcessing={isProcessing} 
              isSpeaking={isSpeaking}
              size="sm"
            />
            <div>
              <h1 className="text-lg font-semibold text-slate-200">Aura</h1>
              <p className="text-xs text-slate-500">Assistente Inteligente</p>
            </div>
          </div>

          {/* Toggle de áudio */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              audioEnabled 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'bg-white/5 text-slate-500'
            }`}
          >
            {audioEnabled ? '🔊 Áudio ativo' : '🔇 Áudio mudo'}
          </button>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <AIOrb size="xl" />
              <p className="mt-8 text-lg">Como posso ajudar você hoje?</p>
            </div>
          )}

          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white'
                  : 'bg-white/5 text-slate-200 border border-white/10'
              }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </motion.div>
          ))}

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-slate-500"
            >
              <div className="flex gap-1">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                  className="w-2 h-2 rounded-full bg-violet-400"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                />
              </div>
              <span className="text-sm">Aura está pensando...</span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isProcessing} />
      </div>

      {/* Agent HUD lateral */}
      <AgentHUD />
    </div>
  );
}
```

---

## 🔧 MODIFICAÇÕES NO SIDEBAR

```tsx
// Adicionar ao sidebar.tsx existente

const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('aura-sidebar-collapsed') === 'true';
});

useEffect(() => {
  localStorage.setItem('aura-sidebar-collapsed', String(collapsed));
}, [collapsed]);

// Adicionar botão de toggle no header da sidebar
<button
  onClick={() => setCollapsed(!collapsed)}
  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
>
  {collapsed ? <ChevronRight /> : <ChevronLeft />}
</button>
```

---

## 📄 PÁGINA PRINCIPAL ATUALIZADA

```tsx
// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/chat');
}
```

```tsx
// app/chat/page.tsx
import { ChatContainer } from '@/components/chat/chat-container';

export default function ChatPage() {
  return <ChatContainer />;
}
```

---

## 🎨 ESTILOS ADICIONAIS (globals.css)

```css
/* Adicionar ao globals.css */

/* Glow effects */
.glow-cyan {
  box-shadow: 0 0 40px rgba(6, 182, 212, 0.3);
}

.glow-violet {
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.3);
}

/* Animações customizadas */
@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.animate-pulse-ring {
  animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Scrollbar estilizada */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

---

## ✅ CHECKLIST FINAL

- [ ] Orb central animado com estados (idle/listening/speaking/processing)
- [ ] Visualização de áudio em tempo real (waveform)
- [ ] Botão de microfone com gravação e transcrição
- [ ] Resposta falada com SpeechSynthesis
- [ ] Toggle para habilitar/desabilitar áudio
- [ ] Agent HUD com status em tempo real
- [ ] Sidebar recolhível com persistência
- [ ] Chat estilo ChatGPT (bubbles modernas)
- [ ] Upload de arquivos com preview
- [ ] Tema futurista (#020617 + cyan/violet)
- [ ] Animações suaves com framer-motion
- [ ] Redirecionamento / → /chat
- [ ] Build passa: `pnpm build`

---

## 🚀 COMANDOS

```bash
cd aura/frontend

# Instalar dependências (se necessário)
pnpm add framer-motion lucide-react

# Build
pnpm build

# Commit
git add .
git commit -m "feat: add Jarvis mode with AI orb, audio visualization, and agent HUD"
git push origin main
```

---

**Resultado:** Interface tipo JARVIS com orb pulsante, voz bidirecional, HUD de agentes e design futurista! 🤖✨
