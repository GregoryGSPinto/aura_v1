'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Pin, RotateCcw, Trash2, Volume2 } from 'lucide-react';

import type { ConversationMessage } from '@/lib/chat-types';
import { cn, getRelativeTime } from '@/lib/utils';
import { haptic } from '@/hooks/use-haptic';
import { ToolCallList } from '@/components/chat/tool-call-block';
import { MissionInlineCard } from '@/components/chat/mission-inline-card';
import { SelfModCard } from '@/components/chat/SelfModCard';
import { AudioPlayer } from '@/components/voice/voice-recorder';

const REACTIONS = ['👍', '👎', '😂', '🔥', '💡', '📌'] as const;

export function MessageBubble({
  message,
  previousUserContent,
  isSpeaking,
  onCopy,
  onRead,
  onRegenerate,
  onTogglePin,
  onDelete,
  onReact,
}: {
  message: ConversationMessage;
  previousUserContent?: string;
  isSpeaking: boolean;
  onCopy: (message: ConversationMessage) => void;
  onRead: (message: ConversationMessage) => void;
  onRegenerate: (message: ConversationMessage, previousUserContent?: string) => void;
  onTogglePin: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}) {
  const isAssistant = message.role === 'assistant';
  const [showActions, setShowActions] = useState(false);
  const [longPressMenu, setLongPressMenu] = useState(false);
  const [reactions, setReactions] = useState<string[]>(message.reactions ?? []);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      haptic.medium();
      setLongPressMenu(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleReaction = useCallback((emoji: string) => {
    setReactions((prev) =>
      prev.includes(emoji) ? prev.filter((r) => r !== emoji) : [...prev, emoji],
    );
    onReact?.(message.id, emoji);
    haptic.light();
    setLongPressMenu(false);
  }, [message.id, onReact]);

  return (
    <article
      className={cn('flex w-full animate-message-in', isAssistant ? 'justify-start' : 'justify-end')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setLongPressMenu(false); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); haptic.medium(); setLongPressMenu(true); }}
    >
      <div className="group relative max-w-[85%] sm:max-w-[75%] lg:max-w-[48rem] xl:max-w-[54rem]">
        {/* Avatar for assistant (desktop only) */}
        {isAssistant && (
          <div className="absolute -left-8 top-3 hidden h-6 w-6 items-center justify-center rounded-full bg-[var(--aura-dark)] text-xs text-[var(--aura-green)] lg:flex">
            ✦
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isAssistant
              ? 'rounded-bl-md bg-[var(--aura-surface-elevated)] border border-[var(--aura-border)] text-white/80'
              : 'rounded-br-md bg-[var(--aura-green-dim)] border border-[rgba(0,212,170,0.12)] text-white/90',
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
              <span className="inline-flex items-center gap-1.5">
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--aura-green)]" />
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--aura-green)]" />
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--aura-green)]" />
              </span>
            ) : '')}
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-zinc-400" />
            )}
          </div>

          {/* Tool calls */}
          {isAssistant && message.toolCalls?.length ? (
            <ToolCallList toolCalls={message.toolCalls} />
          ) : null}

          {/* Audio player — shown when assistant message has synthesized audio */}
          {isAssistant && message.audioUrl && (
            <div className="mt-2">
              <AudioPlayer src={message.audioUrl} autoPlay={message.inputSource === 'voice'} />
            </div>
          )}

          {/* Self-modification card (auto-mod protocol) */}
          {isAssistant && message.selfModPlan && (
            <SelfModCard
              plan={message.selfModPlan}
              approvals={message.needs_approval ?? []}
            />
          )}

          {/* Inline mission card (Sprint 5) */}
          {isAssistant && message.mission && (
            <MissionInlineCard
              missionId={message.mission.id}
              objective={message.mission.objective}
              initialStatus={message.mission.status}
            />
          )}

          {/* Brain / Provider / Route badge */}
          {isAssistant && (message.brain || message.provider || message.route) && (
            <div className="mt-2 flex items-center gap-1">
              {message.brain && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  message.brain === 'cloud'
                    ? 'bg-blue-900/30 text-blue-400'
                    : 'bg-emerald-900/30 text-emerald-400',
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    message.brain === 'cloud' ? 'bg-blue-400' : 'bg-emerald-400',
                  )} />
                  {message.brain === 'cloud' ? 'cloud' : 'local'}
                </span>
              )}
              {message.route === 'agent' || message.route === 'agent_fallback' ? (
                <span className="inline-flex items-center gap-1 rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                  via Agent
                </span>
              ) : message.provider && message.provider !== 'ollama' && !message.brain ? (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  message.provider === 'anthropic' && 'bg-amber-900/30 text-amber-500',
                  message.provider === 'openai' && 'bg-blue-900/30 text-blue-400',
                )}>
                  via {message.provider === 'anthropic' ? 'Claude' : message.provider === 'openai' ? 'GPT' : message.provider}
                </span>
              ) : null}
            </div>
          )}

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

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', isAssistant ? 'justify-start' : 'justify-end')}>
            {reactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="rounded-full bg-white/5 px-1.5 py-0.5 text-xs transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Long-press context menu (mobile) */}
        <AnimatePresence>
          {longPressMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setLongPressMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute z-50 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-lg',
                  isAssistant ? 'left-0 top-full mt-1' : 'right-0 top-full mt-1',
                )}
              >
                {/* Reaction row */}
                <div className="flex gap-1 border-b border-white/5 pb-2 mb-1">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      className={cn(
                        'rounded-lg p-1.5 text-base transition active:scale-110',
                        reactions.includes(emoji) ? 'bg-white/10' : 'hover:bg-white/5',
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-0.5">
                  <ContextMenuItem label="Copiar" icon={Copy} onClick={() => { onCopy(message); setLongPressMenu(false); }} />
                  {isAssistant && (
                    <>
                      <ContextMenuItem label="Ouvir" icon={Volume2} onClick={() => { onRead(message); setLongPressMenu(false); }} />
                      <ContextMenuItem label="Regenerar" icon={RotateCcw} onClick={() => { onRegenerate(message, previousUserContent); setLongPressMenu(false); }} />
                    </>
                  )}
                  <ContextMenuItem label={message.pinned ? 'Desafixar' : 'Fixar'} icon={Pin} onClick={() => { onTogglePin(message.id); setLongPressMenu(false); }} />
                  {onDelete && (
                    <ContextMenuItem label="Apagar" icon={Trash2} onClick={() => { onDelete(message.id); setLongPressMenu(false); }} destructive />
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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

function ContextMenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition active:scale-[0.98]',
        destructive
          ? 'text-red-400 active:bg-red-500/10'
          : 'text-zinc-300 active:bg-white/5',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
