'use client';

import type { ConversationMessage } from '@/lib/chat-types';

import { MessageBubble } from '@/components/chat/message-bubble';

export function MessageList({
  messages,
  activeSpeakingMessageId,
  onCopy,
  onRead,
  onRegenerate,
  onTogglePin,
}: {
  messages: ConversationMessage[];
  activeSpeakingMessageId: string | null;
  onCopy: (message: ConversationMessage) => void;
  onRead: (message: ConversationMessage) => void;
  onRegenerate: (message: ConversationMessage, previousUserContent?: string) => void;
  onTogglePin: (messageId: string) => void;
}) {
  return (
    <div className="space-y-4 pb-4">
      {messages.map((message, index) => {
        const previousUserContent =
          message.role === 'assistant'
            ? [...messages.slice(0, index)].reverse().find((item) => item.role === 'user')?.content
            : undefined;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            previousUserContent={previousUserContent}
            isSpeaking={activeSpeakingMessageId === message.id}
            onCopy={onCopy}
            onRead={onRead}
            onRegenerate={onRegenerate}
            onTogglePin={onTogglePin}
          />
        );
      })}
    </div>
  );
}
