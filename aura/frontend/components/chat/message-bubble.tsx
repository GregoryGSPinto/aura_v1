'use client';

import { useState } from 'react';
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
  const [showActions, setShowActions] = useState(false);

  return (
    <article
      className={cn('flex w-full animate-message-in', isAssistant ? 'justify-start' : 'justify-end')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="group relative max-w-[85%] md:max-w-2xl">
        {/* Avatar for assistant (desktop only) */}
        {isAssistant && (
          <div className="absolute -left-8 top-3 hidden h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400 lg:flex">
            A
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isAssistant
              ? 'rounded-bl-md bg-zinc-900 text-zinc-100'
              : 'rounded-br-md bg-blue-600/90 text-white',
          )}
        >
          {/* Attachments */}
          {message.attachments?.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {message.attachments.map((attachment) => (
                <span
                  key={attachment.id}
                  className="inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs"
                >
                  {attachment.name}
                </span>
              ))}
            </div>
          ) : null}

          {/* Content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content || (message.status === 'pending' ? (
              <span className="inline-flex items-center gap-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
              </span>
            ) : '')}
          </div>

          {/* Pinned indicator */}
          {message.pinned && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
              <Pin className="h-3 w-3" />
              Fixada
            </div>
          )}
        </div>

        {/* Timestamp — hidden by default, shown on hover */}
        <div
          className={cn(
            'mt-1 flex items-center gap-2 text-[11px] text-zinc-600 transition-opacity',
            showActions ? 'opacity-100' : 'opacity-0',
            isAssistant ? 'justify-start pl-1' : 'justify-end pr-1',
          )}
        >
          <span>{getRelativeTime(message.createdAt)}</span>
          {message.modeLabel && isAssistant && (
            <span className="text-zinc-700">{message.modeLabel}</span>
          )}
        </div>

        {/* Action buttons — appear on hover */}
        <div
          className={cn(
            'mt-1 flex items-center gap-1 transition-opacity',
            showActions ? 'opacity-100' : 'opacity-0',
            isAssistant ? 'justify-start' : 'justify-end',
          )}
        >
          <ActionButton
            icon={Copy}
            label="Copiar"
            onClick={() => onCopy(message)}
          />
          {isAssistant && (
            <>
              <ActionButton
                icon={Volume2}
                label="Ouvir"
                onClick={() => onRead(message)}
                active={isSpeaking}
              />
              <ActionButton
                icon={RotateCcw}
                label="Regenerar"
                onClick={() => onRegenerate(message, previousUserContent)}
              />
            </>
          )}
          <ActionButton
            icon={Pin}
            label={message.pinned ? 'Desafixar' : 'Fixar'}
            onClick={() => onTogglePin(message.id)}
            active={message.pinned}
          />
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition',
        active
          ? 'bg-white/10 text-zinc-300'
          : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-400',
      )}
      aria-label={label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
