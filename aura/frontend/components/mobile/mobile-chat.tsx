'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Plus, Settings, X } from 'lucide-react';

import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { BrainSelector } from '@/components/chat/brain-selector';
import { EngineToggle } from '@/components/chat/engine-toggle';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { useAuthStore } from '@/lib/auth-store';
import { useChatStore } from '@/lib/chat-store';
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
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mobile-header flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/90 px-3 pb-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => { haptic.light(); setDrawerOpen(true); }}
          className="rounded-lg p-2 text-zinc-400 active:bg-white/5"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-zinc-200">Aura</span>
        <div className="flex items-center gap-1">
          <EngineToggle />
          <BrainSelector />
          <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
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

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[80%] max-w-[320px] bg-zinc-950 border-r border-white/5"
            >
              <div className="flex h-full flex-col">
                {/* Drawer header */}
                <div className="mobile-header flex items-center justify-between border-b border-white/5 px-4 pb-3">
                  <span className="text-sm font-semibold text-zinc-200">Chats</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleNewChat} className="rounded-lg p-1.5 text-zinc-400 active:bg-white/5">
                      <Plus className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-zinc-400 active:bg-white/5">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Chat list */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  {conversations.slice(0, 20).map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => handleSelectChat(conv.id)}
                        className={cn(
                          'mb-1 flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98]',
                          isActive ? 'bg-white/5 text-zinc-200' : 'text-zinc-500 active:bg-white/[0.03]',
                        )}
                      >
                        <span className="truncate text-sm">{conv.title}</span>
                        <span className="mt-0.5 text-[11px] text-zinc-600">{getRelativeTime(conv.updatedAt)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Drawer footer */}
                <div className="border-t border-white/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs text-zinc-600">
                    <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
                    <span>{runtimeStatus?.model ?? 'qwen3.5:9b'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => useAuthStore.getState().logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 active:bg-red-500/10 active:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
