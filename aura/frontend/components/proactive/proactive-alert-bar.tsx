'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Lightbulb, X, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ProactiveAlert {
  id: string;
  type: 'suggestion' | 'alert' | 'insight';
  title: string;
  message: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  suggestion: { icon: Lightbulb, color: 'text-blue-400' },
  alert: { icon: Bell, color: 'text-amber-400' },
  insight: { icon: Zap, color: 'text-purple-400' },
};

export function ProactiveAlertBar() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ProactiveAlert>).detail;
      if (detail) {
        setAlerts((prev) => {
          if (prev.some((a) => a.id === detail.id)) return prev;
          return [...prev, detail].slice(-5);
        });
      }
    };
    window.addEventListener('aura:proactive-alert', handler);
    return () => window.removeEventListener('aura:proactive-alert', handler);
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleAction = useCallback(
    (alert: ProactiveAlert) => {
      if (alert.action) {
        window.dispatchEvent(
          new CustomEvent('aura:suggestion', { detail: alert.action }),
        );
      }
      dismiss(alert.id);
    },
    [dismiss],
  );

  if (alerts.length === 0) return null;

  return (
    <div className="fixed right-4 top-16 z-40 flex w-80 flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => {
          const cfg = TYPE_CONFIG[alert.type] || TYPE_CONFIG.suggestion;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'rounded-xl border border-white/10 bg-zinc-900/95 p-3 shadow-lg backdrop-blur',
                alert.priority === 'high' && 'border-amber-500/30',
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200">
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                    {alert.message}
                  </p>
                  {alert.action && (
                    <button
                      type="button"
                      onClick={() => handleAction(alert)}
                      className="mt-1.5 rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-blue-400 transition hover:bg-white/10"
                    >
                      Executar
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(alert.id)}
                  className="rounded p-0.5 text-zinc-600 transition hover:text-zinc-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
