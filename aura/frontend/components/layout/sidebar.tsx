'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LogOut,
  MessageSquareText,
  Plus,
  Settings2,
  Wrench,
  BrainCircuit,
  Trash2,
} from 'lucide-react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { ChatModeSelector } from '@/components/chat/mode-selector';
import { useAuthStore } from '@/lib/auth-store';
import { useChatStore } from '@/lib/chat-store';
import { getRelativeTime, cn } from '@/lib/utils';

const navItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquareText },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
  { href: '/remote', label: 'Ferramentas', icon: Wrench },
  { href: '/memory', label: 'Memoria', icon: BrainCircuit },
  { href: '/settings', label: 'Config', icon: Settings2 },
];

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onCloseMobile,
  isMobile = false,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname() ?? '/chat';
  const { runtimeStatus } = useAuraPreferences();
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const selectedModeId = useChatStore((state) => state.selectedModeId);
  const setSelectedMode = useChatStore((state) => state.setSelectedMode);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const deleteConversation = useChatStore((state) => state.clearConversation);

  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const modelName = runtimeStatus?.model ?? 'qwen3.5:9b';

  const handleNewChat = () => {
    const nextId = createConversation();
    setActiveConversation(nextId);
    onCloseMobile?.();
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 border-r border-white/5">
      {/* New Chat Button */}
      <div className="p-3">
        <button
          type="button"
          onClick={handleNewChat}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border border-white/5 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100',
            collapsed && !isMobile && 'justify-center px-0',
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Novo chat</span>}
        </button>
      </div>

      {/* Chat History */}
      {(!collapsed || isMobile) && (
        <div className="flex-1 overflow-y-auto px-2">
          <p className="px-2 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Recentes
          </p>
          <div className="space-y-0.5">
            {conversations.slice(0, 15).map((conversation) => {
              const isActive = pathname === '/chat' && conversation.id === activeConversationId;
              return (
                <div key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversation(conversation.id);
                      onCloseMobile?.();
                    }}
                    className={cn(
                      'w-full rounded-md px-2.5 py-2 text-left transition',
                      isActive
                        ? 'bg-white/5 text-zinc-200'
                        : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300',
                    )}
                  >
                    <p className="truncate text-sm">{conversation.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {getRelativeTime(conversation.updatedAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(conversation.id)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-600 opacity-0 transition hover:bg-white/5 hover:text-zinc-400 group-hover:opacity-100"
                    aria-label="Limpar conversa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed: just icons */}
      {collapsed && !isMobile && (
        <div className="flex-1 overflow-y-auto px-2 pt-2">
          {conversations.slice(0, 8).map((conversation) => {
            const isActive = pathname === '/chat' && conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversation(conversation.id)}
                className={cn(
                  'mb-1 flex w-full items-center justify-center rounded-md p-2 transition',
                  isActive ? 'bg-white/5 text-zinc-300' : 'text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400',
                )}
                title={conversation.title}
              >
                <MessageSquareText className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile: Mode Selector */}
      {isMobile && (
        <div className="border-t border-white/5 px-3 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">Modo</p>
          <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={setSelectedMode} compact />
        </div>
      )}

      {/* Mobile: Mini status */}
      {isMobile && (
        <div className="border-t border-white/5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
            <span className="text-xs text-zinc-500">{modelName}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="border-t border-white/5 p-2">
        {(!collapsed || isMobile) && (
          <p className="px-2 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Navegacao
          </p>
        )}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition',
                  isActive
                    ? 'bg-white/5 text-zinc-200'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300',
                  collapsed && !isMobile && 'justify-center px-2',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout + Collapse Toggle */}
      <div className="border-t border-white/5 p-2 space-y-0.5">
        <button
          type="button"
          onClick={() => useAuthStore.getState().logout()}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400',
            collapsed && !isMobile && 'justify-center px-2',
          )}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Sair</span>}
        </button>

        {!isMobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-md p-2 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
            aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const collapsed = useChatStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useChatStore((state) => state.setSidebarCollapsed);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 ease-out lg:block',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setSidebarCollapsed(!collapsed)}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
            >
              <SidebarContent
                collapsed={false}
                onToggleCollapse={onCloseMobile}
                onCloseMobile={onCloseMobile}
                isMobile
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
