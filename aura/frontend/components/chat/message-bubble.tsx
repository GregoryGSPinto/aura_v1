'use client';

import { Copy, Pin, RotateCcw, Volume2 } from 'lucide-react';

import type { ConversationMessage } from '@/lib/chat-types';
import { cn, getRelativeTime } from '@/lib/utils';

export function MessageBubble({
  message,
  previousUserContent,
  isSpeaking,
  onCopy,
  onRead,
  onRegenerate,
  onTogglePin,
}: {
  message: ConversationMessage;
  previousUserContent?: string;
  isSpeaking: boolean;
  onCopy: (message: ConversationMessage) => void;
  onRead: (message: ConversationMessage) => void;
  onRegenerate: (message: ConversationMessage, previousUserContent?: string) => void;
  onTogglePin: (messageId: string) => void;
}) {
  const isAssistant = message.role === 'assistant';

  return (
    <article className={cn('flex w-full', isAssistant ? 'justify-start' : 'justify-end')}>
      <div className={cn('message-shell max-w-[46rem] px-4 py-4 sm:px-5', isAssistant ? 'message-assistant' : 'message-user')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fg-subtle)]">
              {isAssistant ? 'Aura' : 'Voce'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
              <span>{getRelativeTime(message.createdAt)}</span>
              {message.inputSource === 'voice' ? (
                <span className="rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-secondary)]">
                  Voz
                </span>
              ) : null}
              {message.modeLabel ? (
                <span className="rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-secondary)]">
                  {message.modeLabel}
                </span>
              ) : null}
            </div>
          </div>
          {message.pinned && (
            <span className="rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--fg-secondary)]">
              Fixada
            </span>
          )}
        </div>

        {message.attachments?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-[18px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 py-2 text-xs text-[var(--fg-secondary)]">
                {attachment.name}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--fg-primary)] sm:text-[15px]">
          {message.content || (message.status === 'pending' ? 'Aura esta pensando...' : '')}
        </div>

        {message.meta ? <p className="mt-3 text-xs text-[var(--fg-muted)]">{message.meta}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(message)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 text-xs text-[var(--fg-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          {isAssistant ? (
            <>
              <button
                type="button"
                onClick={() => onRead(message)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-[background,border-color,color] duration-200',
                  isSpeaking
                    ? 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--fg-primary)]'
                    : 'border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]',
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Ouvir
              </button>
              <button
                type="button"
                onClick={() => onRegenerate(message, previousUserContent)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 text-xs text-[var(--fg-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerar
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onTogglePin(message.id)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 text-xs text-[var(--fg-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
          >
            <Pin className="h-3.5 w-3.5" />
            {message.pinned ? 'Desafixar' : 'Fixar'}
          </button>
        </div>
      </div>
    </article>
  );
}
