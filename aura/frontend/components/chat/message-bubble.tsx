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
      <div className={cn('max-w-[44rem] rounded-[28px] border px-4 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] sm:px-5', isAssistant ? 'border-white/10 bg-[rgba(16,22,33,0.92)]' : 'border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(94,170,255,0.2),rgba(119,128,255,0.12))]')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-subtle)]">
              {isAssistant ? 'Aura' : 'Voce'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{getRelativeTime(message.createdAt)}</span>
              {message.inputSource === 'voice' ? (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Voz
                </span>
              ) : null}
              {message.modeLabel ? (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  {message.modeLabel}
                </span>
              ) : null}
            </div>
          </div>
          {message.pinned && (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Fixada
            </span>
          )}
        </div>

        {message.attachments?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]">
                {attachment.name}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-primary)] sm:text-[15px]">
          {message.content || (message.status === 'pending' ? 'Aura esta pensando...' : '')}
        </div>

        {message.meta ? <p className="mt-3 text-xs text-[var(--text-muted)]">{message.meta}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(message)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
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
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition',
                  isSpeaking
                    ? 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--text-primary)]'
                    : 'border-white/10 bg-white/[0.04] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Ouvir
              </button>
              <button
                type="button"
                onClick={() => onRegenerate(message, previousUserContent)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerar
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onTogglePin(message.id)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            <Pin className="h-3.5 w-3.5" />
            {message.pinned ? 'Desafixar' : 'Fixar'}
          </button>
        </div>
      </div>
    </article>
  );
}
