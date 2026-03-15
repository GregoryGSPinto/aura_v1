'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu,
  Mic,
  Paperclip,
  Settings2,
  Sparkles,
  SquarePen,
  Trash2,
  Volume2,
  Ellipsis,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/chat-store';

type TopBarProps = {
  pageMeta: { eyebrow: string; title: string; description: string };
  onOpenSidebar: () => void;
};

const actionConfig = [
  { key: 'attach', label: 'Anexar arquivo', icon: Paperclip },
  { key: 'microphone', label: 'Ativar microfone', icon: Mic },
  { key: 'read-last', label: 'Ouvir ultima resposta', icon: Volume2 },
  { key: 'clear', label: 'Limpar conversa', icon: Trash2 },
] as const;

export function TopBar({ pageMeta, onOpenSidebar }: TopBarProps) {
  const pathname = usePathname() ?? '/chat';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const requestComposerCommand = useChatStore((state) => state.requestComposerCommand);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const lastMessage = activeConversation?.messages.at(-1);
  const isChatRoute = pathname === '/chat';

  const title = isChatRoute ? 'Aura' : pageMeta.title;
  const subtitle = useMemo(() => {
    if (!isChatRoute) return pageMeta.description;
    if (!activeConversation?.messages.length) return 'Assistente pessoal operacional com chat centralizado.';
    if (lastMessage?.role === 'assistant') return lastMessage.meta || 'Resposta pronta no historico.';
    return activeConversation?.title || 'Sessao ativa';
  }, [activeConversation?.messages.length, activeConversation?.title, isChatRoute, lastMessage?.meta, lastMessage?.role, pageMeta.description]);

  const triggerAction = (command: 'attach' | 'microphone' | 'read-last' | 'clear') => {
    requestComposerCommand(command);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="shell-panel sticky top-0 z-30 mb-4 rounded-none border-x-0 border-t-0 px-3 py-3 sm:px-4 lg:mb-5 lg:rounded-[2rem] lg:border lg:px-5 lg:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] text-[var(--fg-primary)] lg:hidden"
              aria-label="Abrir sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden h-11 w-11 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_18%,transparent),color-mix(in_srgb,var(--accent-secondary)_10%,transparent))] lg:flex">
              <Sparkles className="h-5 w-5 text-[var(--fg-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--fg-subtle)]">{pageMeta.eyebrow}</p>
              <h1 className="truncate pt-1 text-xl font-semibold tracking-[-0.05em] text-[var(--fg-primary)] sm:text-[1.7rem]">
                {title}
              </h1>
              <p className="truncate text-sm text-[var(--fg-muted)]">{subtitle}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {!isChatRoute ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const nextId = createConversation();
                    setActiveConversation(nextId);
                  }}
                >
                  <SquarePen className="h-4 w-4" />
                  Novo chat
                </Button>
                {actionConfig.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.key}
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="rounded-full"
                      onClick={() => triggerAction(action.key)}
                      aria-label={action.label}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </>
            ) : null}
            <Link
              href="/settings"
              aria-label="Abrir configuracoes"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] text-[var(--fg-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => triggerAction('microphone')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] text-[var(--fg-primary)]"
              aria-label="Ativar microfone"
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] text-[var(--fg-primary)]"
              aria-label="Abrir acoes"
              aria-expanded={mobileMenuOpen}
            >
              <Ellipsis className="h-5 w-5" />
            </button>
          </div>
        </div>

      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="shell-panel fixed inset-x-3 top-[5.25rem] z-40 rounded-[1.6rem] p-3 lg:hidden"
          >
            <Button
              type="button"
              variant="secondary"
              className="mb-2 h-11 w-full justify-start rounded-[1.1rem]"
              onClick={() => {
                const nextId = createConversation();
                setActiveConversation(nextId);
                setMobileMenuOpen(false);
              }}
            >
              <SquarePen className="h-4 w-4" />
              Novo chat
            </Button>
            {actionConfig.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => triggerAction(action.key)}
                  className="flex h-12 w-full items-center gap-3 rounded-[1.1rem] px-3 text-left text-sm text-[var(--fg-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_96%,transparent)] hover:text-[var(--fg-primary)]"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </button>
              );
            })}
            <Link href="/settings" className="mt-1 flex h-12 items-center gap-3 rounded-[1.1rem] px-3 text-sm text-[var(--fg-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_96%,transparent)] hover:text-[var(--fg-primary)]">
              <Settings2 className="h-4 w-4" />
              Configuracoes
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
