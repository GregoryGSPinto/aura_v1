'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, X } from 'lucide-react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { ApiClientError, sendChat } from '@/lib/api';
import { getAuraChatMode } from '@/lib/chat-modes';
import { useChatStore } from '@/lib/chat-store';
import type { ConversationMessage } from '@/lib/chat-types';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { cn } from '@/lib/utils';

function createMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function ChatSidePanel() {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const { refreshRuntime } = useAuraPreferences();
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const selectedModeId = useChatStore((s) => s.selectedModeId);
  const currentMode = getAuraChatMode(selectedModeId);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const submit = useCallback(async () => {
    const content = draft.trim();
    if (!content || !activeConversation || isLoading) return;

    const userMsg: ConversationMessage = {
      id: createMessageId('message'),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'complete',
      modeLabel: currentMode.label,
    };
    const assistantMsg: ConversationMessage = {
      id: createMessageId('message'),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      modeLabel: currentMode.label,
    };

    setDraft('');
    setIsLoading(true);
    appendMessage(activeConversation.id, userMsg);
    appendMessage(activeConversation.id, assistantMsg);

    const history = activeConversation.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await sendChat(content, history, activeConversation.id, {
        modeId: currentMode.id,
        modeLabel: currentMode.label,
        capability: currentMode.capability,
        temperature: currentMode.request.temperature,
        think: currentMode.request.think,
      });
      const payload = response.data;
      const meta = [payload.intent, currentMode.label, payload.model].filter(Boolean).join(' · ');
      updateMessage(activeConversation.id, assistantMsg.id, {
        content: payload.response,
        status: 'complete',
        meta,
        model: payload.model,
        modeLabel: currentMode.label,
      });
      await refreshRuntime();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao processar.';
      updateMessage(activeConversation.id, assistantMsg.id, {
        content: msg,
        status: 'error',
        meta: 'Erro',
        modeLabel: currentMode.label,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeConversation, appendMessage, currentMode, draft, isLoading, refreshRuntime, updateMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-white/5 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-xs font-medium text-zinc-300">Aura</span>
        <button
          type="button"
          onClick={() => setWorkspace('chat')}
          className="rounded p-1 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
          aria-label="Expandir chat"
          title="Modo Conversa"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'text-xs leading-relaxed',
                msg.role === 'user' ? 'text-zinc-300' : 'text-zinc-500',
              )}
            >
              <span className="font-medium text-zinc-600">
                {msg.role === 'user' ? 'Gregory' : 'Aura'}:
              </span>{' '}
              {msg.status === 'pending' ? (
                <span className="inline-flex gap-0.5">
                  <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" />
                </span>
              ) : (
                msg.content
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-white/5 p-2">
        <div className="flex items-center gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
