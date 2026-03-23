'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Moon, Sun, Volume2, Zap } from 'lucide-react';

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
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-0 z-[60] rounded-b-2xl border-b border-white/5 bg-zinc-950/95 backdrop-blur-xl"
          >
            <div className="mobile-header px-4 pb-4">
              {/* Handle */}
              <div className="flex justify-center py-2">
                <div className="h-1 w-10 rounded-full bg-zinc-700" />
              </div>

              {/* Engine + Brain */}
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900 px-4 py-3">
                <div className="flex items-center gap-3">
                  <EngineToggle />
                  <BrainSelector />
                </div>
                <span className={cn('h-3 w-3 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
              </div>

              {/* Quick toggles */}
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
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-zinc-900 px-4 py-3 text-sm text-zinc-400 active:bg-white/5"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
