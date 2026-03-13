'use client';

import { Brain, Search, Sparkles, Zap } from 'lucide-react';

import { AURA_CHAT_MODES, getAuraChatMode, type AuraChatModeId } from '@/lib/chat-modes';
import { cn } from '@/lib/utils';

function iconForCapability(capability: string) {
  switch (capability) {
    case 'fast':
      return Zap;
    case 'deep':
      return Brain;
    case 'research':
      return Search;
    default:
      return Sparkles;
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
  const selectedMode = getAuraChatMode(selectedModeId);

  return (
    <div className="space-y-3">
      {!compact ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Modos da Aura</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{selectedMode.description}</p>
        </div>
      ) : null}

      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        {AURA_CHAT_MODES.map((mode) => {
          const Icon = iconForCapability(mode.capability);
          const isActive = mode.id === selectedModeId;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm transition',
                isActive
                  ? 'border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(131,205,255,0.16),rgba(119,128,255,0.14))] text-[var(--text-primary)] shadow-[0_12px_32px_rgba(36,86,154,0.18)]'
                  : 'border-white/10 bg-white/[0.03] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-[var(--text-primary)]',
                compact && 'min-h-9 px-3 py-1.5 text-xs',
              )}
              aria-pressed={isActive}
            >
              <Icon className={cn('h-4 w-4', compact && 'h-3.5 w-3.5')} />
              {compact ? mode.shortLabel : mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
