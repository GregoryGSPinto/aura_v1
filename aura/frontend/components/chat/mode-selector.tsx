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
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Modo da conversa</p>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">{selectedMode.description}</p>
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
                'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-[background,border-color,color,box-shadow] duration-200',
                isActive
                  ? 'border-[var(--border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_14%,transparent),color-mix(in_srgb,var(--accent-secondary)_12%,transparent))] text-[var(--fg-primary)] shadow-[0_12px_24px_rgba(54,86,144,0.14)]'
                  : 'border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-default)] hover:text-[var(--fg-primary)]',
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
