'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, RotateCcw, Star } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  read: boolean;
  starred: boolean;
  priority: 'high' | 'normal' | 'low';
}

export function EmailWidget() {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(
        `${base}/api/v1/integrations/email/inbox?limit=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setEmails(data.data ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold text-zinc-200">E-mail</span>
          {emails.filter((e) => !e.read).length > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {emails.filter((e) => !e.read).length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <RotateCcw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && emails.length === 0 ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        </div>
      ) : emails.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-zinc-600">
          Nenhum e-mail recente
        </p>
      ) : (
        <div className="space-y-1">
          {emails.map((email) => (
            <div
              key={email.id}
              className={cn(
                'rounded-md px-2.5 py-2 transition hover:bg-white/5',
                !email.read && 'border-l-2 border-blue-500/50',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex-1 truncate text-xs',
                    email.read ? 'text-zinc-400' : 'font-semibold text-zinc-200',
                  )}
                >
                  {email.from}
                </span>
                {email.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                {email.priority === 'high' && (
                  <span className="rounded bg-red-500/10 px-1 text-[9px] font-bold text-red-400">!</span>
                )}
              </div>
              <p
                className={cn(
                  'truncate text-[11px]',
                  email.read ? 'text-zinc-500' : 'text-zinc-300',
                )}
              >
                {email.subject}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                {email.snippet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
