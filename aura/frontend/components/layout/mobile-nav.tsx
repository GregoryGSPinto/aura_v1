'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bot,
  FolderOpen,
  Grid2x2,
  House,
  MessageSquareText,
  Monitor,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryItems = [
  { href: '/', label: 'Home', icon: House },
  { href: '/chat', label: 'Conversa', icon: MessageSquareText },
];

const menuItems = [
  { href: '/swarm', label: 'Rotinas', icon: Bot },
  { href: '/projects', label: 'Projetos', icon: FolderOpen },
  { href: '/remote', label: 'Ferramentas', icon: Monitor },
  { href: '/system', label: 'Operacao', icon: Activity },
  { href: '/settings', label: 'Configuracoes', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="mobile-bottom-nav lg:hidden">
        <div className="glass-strong mx-auto flex w-[calc(100%-1rem)] max-w-md items-center justify-between rounded-[1.75rem] border border-[var(--border-default)] px-3 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-white/10 text-[var(--gold)]'
                    : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-all',
              menuOpen
                ? 'bg-white/10 text-[var(--cyan)]'
                : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            )}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu-sheet"
          >
            <Grid2x2 className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            />

            <motion.section
              id="mobile-menu-sheet"
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] lg:hidden"
            >
              <div className="glass-strong overflow-hidden rounded-[2rem] border border-[var(--border-default)] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)]">
                      <Sparkles className="h-5 w-5 text-black" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Aura</p>
                      <p className="text-xs text-[var(--text-muted)]">Acesso rapido</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
                    aria-label="Fechar menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 p-3">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-4 py-4 transition-all',
                          isActive
                            ? 'bg-white/10 text-[var(--gold)]'
                            : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                        )}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-[var(--text-muted)]">Abrir {item.label.toLowerCase()}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
