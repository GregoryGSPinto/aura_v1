'use client';

import { Bot, Cloud, Mic, Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';

function indicatorTone(isActive: boolean, fallback: 'default' | 'yellow' | 'green' | 'red' = 'default') {
  if (isActive) return 'green';
  return fallback;
}

export function ChatStatusBadges({ compact = false }: { compact?: boolean }) {
  const { runtimeStatus, voiceStatus } = useAuraPreferences();
  const backendOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const voiceReady = Boolean(voiceStatus?.pipeline_ready || (voiceStatus?.stt_ready && voiceStatus?.tts_ready));

  const items = [
    {
      key: 'backend',
      icon: Cloud,
      label: backendOnline ? 'Backend online' : 'Backend offline',
      variant: indicatorTone(backendOnline, 'red'),
    },
    {
      key: 'voice',
      icon: Mic,
      label: voiceReady ? 'Voz ativa' : 'Voz inativa',
      variant: indicatorTone(voiceReady, 'yellow'),
    },
    {
      key: 'model',
      icon: Bot,
      label: runtimeStatus?.model ?? 'Modelo indisponivel',
      variant: 'default' as const,
    },
    {
      key: 'session',
      icon: Radio,
      label: backendOnline ? 'Sessao sincronizada' : 'Sessao local',
      variant: indicatorTone(backendOnline, 'yellow'),
    },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Badge key={item.key} variant={item.variant} className={cn('h-8 rounded-full px-3', compact && 'h-7 px-2.5')}>
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {item.label}
          </Badge>
        );
      })}
    </div>
  );
}
