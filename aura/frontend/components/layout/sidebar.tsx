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
    <div className="shell-panel flex h-full flex-col rounded-[2rem] p-3.5">
      <div className="shell-card flex items-center justify-between gap-3 rounded-[1.6rem] px-3.5 py-3.5">
        <Link href="/chat" className="flex min-w-0 items-center gap-3" onClick={onCloseMobile}>
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_28%,transparent),color-mix(in_srgb,var(--accent-secondary)_18%,transparent))] shadow-[0_14px_30px_rgba(56,90,152,0.2)]">
            <Sparkles className="h-5 w-5 text-[var(--fg-primary)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fg-subtle)]">Aura</p>
              <p className="truncate text-sm font-medium text-[var(--fg-primary)]">Assistant Runtime</p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] p-2 text-[var(--fg-muted)] transition hover:border-[var(--border-default)] hover:text-[var(--fg-primary)] lg:inline-flex"
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="button"
        variant="gold"
        className={cn('mt-3 h-12 w-full justify-start rounded-[1.35rem] px-4', collapsed && 'justify-center px-0')}
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
        {!collapsed && <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Historico</p>}
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
                  'w-full rounded-[1.2rem] border px-3.5 py-3 text-left transition-[background,border-color,color,transform] duration-200',
                  isActive
                    ? 'border-[var(--border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_14%,transparent),color-mix(in_srgb,var(--accent-secondary)_10%,transparent))]'
                    : 'border-transparent bg-transparent hover:border-[var(--border-subtle)] hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_96%,transparent)]',
                )}
              >
                {collapsed ? (
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)]">
                    <MessageSquareText className="h-4 w-4 text-[var(--fg-secondary)]" />
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{conversation.title}</p>
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">
                      {conversation.messages.length} mensagens · {getRelativeTime(conversation.updatedAt)}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        {!collapsed && <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Navegacao</p>}
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
                  'flex items-center gap-3 rounded-[1.2rem] px-3.5 py-3 transition-[background,border-color,color] duration-200',
                  isActive
                    ? 'bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_100%,transparent)] text-[var(--fg-primary)]'
                    : 'text-[var(--fg-muted)] hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] hover:text-[var(--fg-primary)]',
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

      <div className="shell-card mt-auto rounded-[1.4rem] px-3 py-3">
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', runtimeStatus?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400')} />
          {!collapsed && (
            <div>
              <p className="text-xs font-medium text-[var(--fg-primary)]">
                {runtimeStatus?.services.api === 'online' ? 'Conectado ao backend' : 'Backend indisponivel'}
              </p>
              <p className="text-[11px] text-[var(--fg-muted)]">
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
      <aside className={cn('hidden lg:block', collapsed ? 'w-[98px]' : 'w-[318px]')}>
        <div className="sticky top-5 h-[calc(100vh-2.5rem)]">
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
              className="fixed inset-0 z-40 bg-[rgba(8,14,24,0.44)] backdrop-blur-sm lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fechar menu lateral"
            />
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[348px] p-3 lg:hidden"
            >
              <SidebarContent collapsed={false} onToggleCollapse={onCloseMobile} onCloseMobile={onCloseMobile} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
