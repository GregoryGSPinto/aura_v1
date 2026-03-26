'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, MessageSquareText, Plus, Trash2, X } from 'lucide-react';

import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { BrainSelector } from '@/components/chat/brain-selector';
import { EngineToggle } from '@/components/chat/engine-toggle';
import { SmartChips } from '@/components/mobile/smart-chips';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { useAuthStore } from '@/lib/auth-store';
import { useChatStore } from '@/lib/chat-store';
import { getAuraChatMode } from '@/lib/chat-modes';
import { getRelativeTime, cn } from '@/lib/utils';
import { haptic } from '@/hooks/use-haptic';
import { usePullRefresh } from '@/hooks/use-pull-refresh';

export function MobileChat() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { runtimeStatus, refreshRuntime } = useAuraPreferences();
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const deleteConversation = useChatStore((s) => s.clearConversation);
  const selectedModeId = useChatStore((s) => s.selectedModeId);
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMode = getAuraChatMode(selectedModeId);

  // Smart chips: get last assistant message
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [];
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.status === 'complete');
  const [showChips, setShowChips] = useState(true);

  // Pick up shared content from other apps
  useEffect(() => {
    const shared = sessionStorage.getItem('aura_shared_message');
    if (shared) {
      sessionStorage.removeItem('aura_shared_message');
      // Dispatch event for ChatWorkspace to pick up
      window.dispatchEvent(new CustomEvent('aura:suggestion', { detail: shared }));
    }
  }, []);

  const handleChipMessage = useCallback((text: string) => {
    setShowChips(false);
    window.dispatchEvent(new CustomEvent('aura:suggestion', { detail: text }));
  }, []);

  const { pullDistance, refreshing, handlers } = usePullRefresh({
    onRefresh: () => refreshRuntime(),
  });

  const handleNewChat = () => {
    haptic.medium();
    const id = createConversation();
    setActiveConversation(id);
    setDrawerOpen(false);
  };

  const handleSelectChat = (id: string) => {
    haptic.light();
    setActiveConversation(id);
    setDrawerOpen(false);
  };

  const handleResetChat = (id: string) => {
    haptic.light();
    deleteConversation(id);
  };

  return (
    <div className="relative flex h-full flex-col bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_42%)]">
      {/* Header */}
      <div className="mobile-header sticky top-0 z-20 shrink-0 border-b border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface)_84%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-[calc(var(--sal)+0.875rem)] pb-3 pr-[calc(var(--sar)+0.875rem)]">
          <button
            type="button"
            onClick={() => { haptic.light(); setDrawerOpen(true); }}
            className="app-control flex min-w-0 flex-1 items-center justify-between rounded-[1.1rem] px-3.5 py-2.5 text-left"
            aria-expanded={drawerOpen}
            aria-controls="mobile-chat-drawer"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
                Workspace
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-100">Conversa</span>
                <span className="truncate text-xs text-zinc-500">{currentMode.shortLabel}</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>

          <div className="app-control flex items-center gap-2 rounded-[1rem] px-2.5 py-2">
            <EngineToggle />
            <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="app-control inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-zinc-300"
            aria-label="Novo chat"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center py-2" style={{ height: pullDistance }}>
          <div className={cn('h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent', refreshing && 'animate-spin')} />
        </div>
      )}

      {/* Chat content */}
      <div ref={containerRef} className="flex-1 overflow-hidden" {...handlers}>
        <ChatWorkspace />
      </div>

      {/* Smart reply chips */}
      <div className="px-[calc(var(--sal)+0.5rem)] pr-[calc(var(--sar)+0.5rem)]">
        <SmartChips
          lastAssistantMessage={lastAssistantMsg?.content ?? ''}
          onSendMessage={handleChipMessage}
          visible={showChips && !!lastAssistantMsg && messages.length > 0}
        />
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-md"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              id="mobile-chat-drawer"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -28, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-[80] w-full max-w-[24rem] pl-[calc(var(--sal)+0.75rem)] pr-6 pt-[calc(var(--sat)+0.75rem)] pb-[calc(var(--sab)+5.75rem)]"
            >
              <div className="app-popover flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface)_88%,transparent)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between border-b border-white/5 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
                      Conversas
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_55%,var(--bg-surface))] text-zinc-200">
                        <MessageSquareText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">Aura</p>
                        <p className="truncate text-xs text-zinc-500">{runtimeStatus?.model ?? 'qwen3.5:9b'}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-zinc-400 transition active:scale-[0.98] active:bg-white/10"
                    aria-label="Fechar painel"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_65%,var(--bg-surface))] px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200">Modo atual</p>
                      <p className="truncate text-[11px] text-zinc-500">{currentMode.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EngineToggle />
                      <BrainSelector />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1rem] bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition active:scale-[0.99] active:bg-blue-500"
                  >
                    <Plus className="h-4 w-4" />
                    Novo chat
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3">
                  <div className="space-y-1.5">
                    {conversations.slice(0, 20).map((conv) => {
                      const isActive = conv.id === activeConversationId;
                      return (
                        <div
                          key={conv.id}
                          className={cn(
                            'group rounded-[1.15rem] border transition',
                            isActive
                              ? 'border-white/10 bg-white/[0.04]'
                              : 'border-transparent bg-transparent',
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-start justify-between gap-3 rounded-[1.15rem] px-3.5 py-3 transition',
                              isActive ? 'text-zinc-100' : 'text-zinc-400',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectChat(conv.id)}
                              className="min-w-0 flex-1 text-left transition active:scale-[0.99]"
                            >
                              <p className="truncate text-sm font-medium">{conv.title}</p>
                              <p className="mt-1 text-[11px] text-zinc-600">{getRelativeTime(conv.updatedAt)}</p>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleResetChat(conv.id);
                              }}
                              className="opacity-100 rounded-lg p-2 text-zinc-600 transition active:bg-red-500/10 active:text-red-400"
                              aria-label="Limpar conversa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/5 px-4 py-4">
                  <div className="rounded-[1.1rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_65%,var(--bg-surface))] px-3.5 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Conexão</span>
                      <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Sessão</span>
                      <span className="text-zinc-300">{activeConversation?.title ? 'Ativa' : 'Nova'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => useAuthStore.getState().logout()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1rem] border border-red-500/15 bg-red-500/6 px-4 py-3 text-sm text-red-300 transition active:scale-[0.99] active:bg-red-500/12"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
