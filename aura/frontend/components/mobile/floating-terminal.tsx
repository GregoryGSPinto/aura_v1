'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function FloatingTerminal() {
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [state, setState] = useState<'mini' | 'compact' | 'expanded'>('compact');
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Listen for terminal events
  useEffect(() => {
    const handleTerminal = (e: Event) => {
      const detail = (e as CustomEvent<{ type: string; line?: string; exitCode?: number }>).detail;
      if (!detail) return;
      if (detail.type === 'start') {
        setVisible(true);
        setLines([]);
        setIsRunning(true);
        setExitCode(null);
      } else if (detail.type === 'output' && detail.line) {
        setLines((prev) => [...prev, detail.line!]);
      } else if (detail.type === 'end') {
        setIsRunning(false);
        setExitCode(detail.exitCode ?? 0);
      }
    };
    window.addEventListener('aura:terminal', handleTerminal);
    return () => window.removeEventListener('aura:terminal', handleTerminal);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      dragRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = dragRef.current.startX - touch.clientX;
    const dy = dragRef.current.startY - touch.clientY;
    setPosition({
      x: Math.max(0, dragRef.current.posX + dx),
      y: Math.max(60, dragRef.current.posY + dy),
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const snapX = position.x > vw / 2 - 140 ? 16 : vw - 296;
    setPosition((p) => ({ ...p, x: Math.max(16, Math.min(snapX, vw - 296)) }));
    dragRef.current = null;
  }, [position.x]);

  if (!visible) return null;

  const statusIcon = isRunning ? '\u23f3' : exitCode === 0 ? '\u2705' : exitCode != null ? '\u274c' : '';

  return (
    <div
      className="fixed z-50 overflow-hidden rounded-xl border border-zinc-700/50 shadow-2xl"
      style={{
        right: position.x,
        bottom: position.y,
        width: state === 'expanded' ? '90vw' : state === 'compact' ? 280 : 140,
        transition: 'width 200ms ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">&gt;_</span>
          {isRunning && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          )}
          {statusIcon && <span className="text-xs">{statusIcon}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setState((s) => (s === 'compact' ? 'expanded' : 'compact'))}
            className="p-1 text-xs text-zinc-500 active:text-zinc-300"
          >
            {state === 'expanded' ? '\u2199' : '\u2197'}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="p-1 text-xs text-zinc-500 active:text-red-400"
          >
            \u2715
          </button>
        </div>
      </div>

      {/* Output */}
      {state !== 'mini' && (
        <div className={cn(
          'overflow-y-auto bg-black p-2 font-mono text-[11px] text-zinc-300',
          state === 'compact' ? 'max-h-24' : 'max-h-60',
        )}>
          {lines.slice(state === 'compact' ? -4 : -20).map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">{line}</div>
          ))}
          {lines.length === 0 && (
            <div className="text-zinc-600">Sem output</div>
          )}
        </div>
      )}
    </div>
  );
}
