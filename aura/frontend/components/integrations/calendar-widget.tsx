'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Loader2, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dateOffset);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const dateLabel = targetDate.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = process.env.NEXT_PUBLIC_AURA_TOKEN || '';
      const res = await fetch(
        `${base}/api/v1/integrations/calendar/events?date=${dateStr}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data.data ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-200">Agenda</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDateOffset((d) => d - 1)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="min-w-[5rem] text-center text-[11px] text-zinc-400">
            {dateLabel}
          </span>
          <button
            type="button"
            onClick={() => setDateOffset((d) => d + 1)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <RotateCcw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        </div>
      ) : events.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-zinc-600">
          Nenhum evento para este dia
        </p>
      ) : (
        <div className="space-y-1.5">
          {events.map((ev) => (
            <div
              key={ev.id}
              className={cn(
                'rounded-md border-l-2 px-2.5 py-1.5',
                ev.status === 'cancelled'
                  ? 'border-red-500/50 opacity-50'
                  : ev.status === 'tentative'
                    ? 'border-yellow-500/50'
                    : 'border-blue-500/50',
              )}
            >
              <p className="text-xs font-medium text-zinc-300">{ev.title}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Clock className="h-2.5 w-2.5" />
                <span>
                  {formatTime(ev.start)} - {formatTime(ev.end)}
                </span>
                {ev.location && (
                  <>
                    <span>·</span>
                    <span className="truncate">{ev.location}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
