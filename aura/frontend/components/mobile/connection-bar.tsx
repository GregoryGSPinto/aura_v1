'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { offlineQueue } from '@/lib/offline-queue';

type ConnectionStatus = 'online' | 'offline' | 'backend-down' | 'reconnected';

export function ConnectionBar() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [wasOffline, setWasOffline] = useState(false);

  const checkBackend = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      setWasOffline(true);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const url = base.endsWith('/api/v1') ? `${base}/status` : `${base}/api/v1/status`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      clearTimeout(timer);

      if (res.ok) {
        if (wasOffline) {
          setStatus('reconnected');
          setWasOffline(false);
          // Process queued offline messages
          offlineQueue.processQueue().catch(() => {});
          setTimeout(() => setStatus('online'), 3000);
        } else {
          setStatus('online');
        }
      } else {
        setStatus('backend-down');
        setWasOffline(true);
      }
    } catch {
      setStatus('backend-down');
      setWasOffline(true);
    }
  }, [wasOffline]);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 15000);

    const handleOnline = () => checkBackend();
    const handleOffline = () => {
      setStatus('offline');
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkBackend]);

  const showBar = status !== 'online';

  const config: Record<string, { bg: string; text: string }> = {
    offline: {
      bg: 'bg-red-900/90',
      text: 'Sem conexão — mensagens serão enviadas ao reconectar',
    },
    'backend-down': {
      bg: 'bg-amber-900/90',
      text: 'Backend indisponível — tentando reconectar...',
    },
    reconnected: {
      bg: 'bg-green-900/90',
      text: 'Reconectado!',
    },
  };

  return (
    <AnimatePresence>
      {showBar && config[status] && (
        <motion.div
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'flex h-8 items-center justify-center text-xs text-white/90',
            config[status].bg,
          )}
        >
          {config[status].text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
