'use client';

import { Brain, Search, Sparkles, Zap } from 'lucide-react';

import { AURA_CHAT_MODES, type AuraChatModeId } from '@/lib/chat-modes';
import { cn } from '@/lib/utils';

function iconForCapability(capability: string) {
  switch (capability) {
    case 'fast': return Zap;
    case 'deep': return Brain;
    case 'research': return Search;
    default: return Sparkles;
  }
}

export function ChatModeSelector({
  selectedModeId,
  onSelectMode,
  compact = false,
}: {
  selectedModeId: AuraChatModeId;
  onSelectMode: (modeId: AuraChatModeId) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AURA_CHAT_MODES.map((mode) => {
        const Icon = iconForCapability(mode.capability);
        const isActive = mode.id === selectedModeId;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelectMode(mode.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition',
              isActive
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                : 'border-white/5 bg-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-400',
              compact && 'px-2 py-1 text-[11px]',
            )}
            aria-pressed={isActive}
            title={mode.description}
          >
            <Icon className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
            {compact ? mode.shortLabel : mode.label}
          </button>
        );
      })}
    </div>
  );
}
