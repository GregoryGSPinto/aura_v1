'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  MessageSquareText,
  Settings2,
  Sparkles,
  Wrench,
  BrainCircuit,
} from 'lucide-react';

import { useAuraPreferences } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/chat-store';
import { clientEnv } from '@/lib/env';
import { getRelativeTime, cn } from '@/lib/utils';

const shortcutItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquareText },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
  { href: '/remote', label: 'Ferramentas', icon: Wrench },
  { href: '/memory', label: 'Memoria', icon: BrainCircuit },
  { href: '/settings', label: 'Configuracoes', icon: Settings2 },
];

function inferConnectionMode(apiUrl?: string) {
  if (!apiUrl) return 'desconhecido';
  return apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1') ? 'local' : 'remoto';
}

type SidebarContentProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
};

function SidebarContent({ collapsed, onToggleCollapse, onCloseMobile }: SidebarContentProps) {
  const pathname = usePathname() ?? '/chat';
  const { runtimeStatus } = useAuraPreferences();
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

  const connectionMode = inferConnectionMode(clientEnv.apiUrl);
  const environmentName = clientEnv.auraEnv ?? 'local';

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[rgba(9,14,23,0.86)] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.045] px-3 py-3">
        <Link href="/chat" className="flex min-w-0 items-center gap-3" onClick={onCloseMobile}>
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[radial-gradient(circle_at_top_left,rgba(245,247,255,0.18),transparent_42%),linear-gradient(135deg,rgba(115,190,255,0.26),rgba(110,130,255,0.18))] shadow-[0_12px_30px_rgba(64,116,194,0.28)]">
            <Sparkles className="h-5 w-5 text-[var(--accent-cyan)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-subtle)]">Aura</p>
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">Personal AI Operator</p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-[var(--text-muted)] transition hover:bg-white/[0.08] hover:text-[var(--text-primary)] lg:inline-flex"
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="button"
        variant="secondary"
        className={cn('mt-3 h-12 w-full justify-start rounded-[22px] border border-white/10 bg-white/[0.05] px-4 text-[var(--text-primary)]', collapsed && 'justify-center px-0')}
        onClick={() => {
          const nextId = createConversation();
          setActiveConversation(nextId);
          onCloseMobile?.();
        }}
      >
        <span className="text-lg">+</span>
        {!collapsed && <span>Novo chat</span>}
      </Button>

      <div className="mt-4">
        {!collapsed && <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Historico</p>}
        <div className="mt-2 space-y-1.5">
          {conversations.slice(0, 10).map((conversation) => {
            const isActive = pathname === '/chat' && conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setActiveConversation(conversation.id);
                  onCloseMobile?.();
                }}
                className={cn(
                  'w-full rounded-[20px] border px-3 py-3 text-left transition',
                  isActive
                    ? 'border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(111,193,255,0.12),rgba(118,129,255,0.08))]'
                    : 'border-transparent bg-transparent hover:border-white/8 hover:bg-white/[0.045]',
                )}
              >
                {collapsed ? (
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <MessageSquareText className="h-4 w-4 text-[var(--text-secondary)]" />
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{conversation.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {conversation.messages.length} mensagens · {getRelativeTime(conversation.updatedAt)}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-white/8 pt-4">
        {!collapsed && <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">Atalhos</p>}
        <nav className="mt-2 space-y-1.5">
          {shortcutItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-3 rounded-[20px] px-3 py-3 transition',
                  isActive
                    ? 'bg-white/[0.08] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]',
                  collapsed && 'justify-center',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto rounded-[22px] border border-white/8 bg-white/[0.045] px-3 py-3">
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', runtimeStatus?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400')} />
          {!collapsed && (
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">
                {runtimeStatus?.services.api === 'online' ? 'Conectado ao backend' : 'Backend indisponivel'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {connectionMode} · {environmentName}
              </p>
            </div>
          )}
        </div>
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
      <aside className={cn('hidden lg:block', collapsed ? 'w-[96px]' : 'w-[320px]')}>
        <div className="sticky top-4 h-[calc(100vh-2rem)]">
          <SidebarContent
            collapsed={collapsed}
            onToggleCollapse={() => setSidebarCollapsed(!collapsed)}
          />
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(4,8,14,0.78)] backdrop-blur-sm lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fechar menu lateral"
            />
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] p-3 lg:hidden"
            >
              <SidebarContent collapsed={false} onToggleCollapse={onCloseMobile} onCloseMobile={onCloseMobile} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
