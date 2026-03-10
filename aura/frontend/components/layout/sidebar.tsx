'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Monitor,
  FolderOpen,
  Activity,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; badge?: number; highlight?: boolean }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/swarm', label: 'Swarm', icon: Bot, badge: 3, highlight: true },
  { href: '/remote', label: 'Remoto', icon: Monitor },
  { href: '/projects', label: 'Projetos', icon: FolderOpen },
  { href: '/system', label: 'Sistema', icon: Activity },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  const collapsed = false;

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--border-subtle)] glass-strong transition-all duration-300 lg:flex lg:translate-x-0',
        collapsed ? 'lg:w-20' : 'lg:w-72'
      )}
    >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <Link 
            href="/" 
            className={cn(
              'flex items-center gap-3 p-6 border-b border-[var(--border-subtle)]',
              collapsed && 'lg:justify-center lg:px-4'
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] blur-lg opacity-50" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="text-xl font-bold text-gradient-gold whitespace-nowrap">Aura</h1>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Assistente IA</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={item.href as any}
                  className={cn(
                    'relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                    isActive
                      ? 'bg-white/10 text-[var(--gold)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5',
                    collapsed && 'lg:justify-center lg:px-3',
                    item.highlight && !isActive && 'text-[var(--cyan)]'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 w-1 h-6 bg-gradient-to-b from-[var(--gold)] to-[var(--cyan)] rounded-r-full"
                    />
                  )}
                  {item.highlight && !isActive && (
                    <div className="absolute left-0 w-1 h-6 bg-[var(--cyan)]/50 rounded-r-full animate-pulse" />
                  )}
                  <Icon className={cn('w-5 h-5 flex-shrink-0', item.highlight && !isActive && 'animate-pulse')} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="font-medium whitespace-nowrap overflow-hidden flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!collapsed && item.badge && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full flex-shrink-0',
                      item.highlight 
                        ? 'bg-[var(--cyan)]/20 text-[var(--cyan)]'
                        : 'bg-[var(--gold)]/20 text-[var(--gold)]'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status */}
          <div className={cn(
            'p-4 border-t border-[var(--border-subtle)]',
            collapsed && 'lg:p-3'
          )}>
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5',
              collapsed && 'lg:justify-center lg:px-2'
            )}>
              <div className="relative flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-50" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden flex-1"
                  >
                    <p className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap">Online</p>
                    <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">3 agentes ativos</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>
  );
}
