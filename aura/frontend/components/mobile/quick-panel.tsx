'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sun, Volume2, Zap } from 'lucide-react';

import { EngineToggle } from '@/components/chat/engine-toggle';
import { BrainSelector } from '@/components/chat/brain-selector';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { haptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

export function QuickPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { runtimeStatus } = useAuraPreferences();
  const isOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-0 z-[65] px-[calc(var(--sal)+0.75rem)] pr-[calc(var(--sar)+0.75rem)] pt-[calc(var(--sat)+0.5rem)]"
          >
            <div className="app-popover overflow-hidden rounded-[1.6rem] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)] shadow-[0_24px_64px_rgba(0,0,0,0.38)]">
              <div className="px-4 pb-4 pt-3">
                <div className="flex justify-center py-2">
                <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                <div className="flex items-center justify-between rounded-[1.15rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_65%,var(--bg-surface))] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">Controles</p>
                    <p className="mt-1 text-sm font-medium text-zinc-100">Sessão rápida</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <EngineToggle />
                    <BrainSelector />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { icon: Sun, label: 'Tema', action: () => haptic.light() },
                    { icon: Volume2, label: 'Voz', action: () => haptic.light() },
                    { icon: Bell, label: 'Notificacoes', action: () => haptic.light() },
                    { icon: Zap, label: 'Workflows', action: () => haptic.light() },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        className="flex items-center gap-2.5 rounded-[1.1rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_65%,var(--bg-surface))] px-4 py-3 text-sm text-zinc-300 active:bg-white/5"
                      >
                        <Icon className="h-4 w-4 text-zinc-500" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between rounded-[1.1rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_65%,var(--bg-surface))] px-4 py-3 text-sm">
                  <span className="text-zinc-400">Backend</span>
                  <span className={cn('font-medium', isOnline ? 'text-green-400' : 'text-red-400')}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
