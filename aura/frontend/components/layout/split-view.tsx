'use client';

/**
 * Split View — Container com dois painéis e drag handle redimensionável.
 *
 * Props:
 * - left: ReactNode (chat)
 * - right: ReactNode (terminal)
 * - isRightOpen: boolean
 * - defaultRightWidth: number (% — default 40)
 * - minRightWidth: number (% — default 25)
 * - maxRightWidth: number (% — default 70)
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTerminalStore } from '@/lib/terminal-store';

type SplitViewProps = {
  left: ReactNode;
  right: ReactNode;
  isRightOpen: boolean;
};

export function SplitView({ left, right, isRightOpen }: SplitViewProps) {
  const splitWidth = useTerminalStore((s) => s.splitWidth);
  const setSplitWidth = useTerminalStore((s) => s.setSplitWidth);

  const [rightWidth, setRightWidth] = useState(splitWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync from store on mount
  useEffect(() => {
    setRightWidth(splitWidth);
  }, [splitWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalWidth = rect.width;
      const leftPercent = (x / totalWidth) * 100;
      const newRightWidth = Math.min(70, Math.max(25, 100 - leftPercent));
      setRightWidth(newRightWidth);
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setSplitWidth(rightWidth);
    }
  }, [isDragging, rightWidth, setSplitWidth]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = useCallback(() => {
    setRightWidth(50);
    setSplitWidth(50);
  }, [setSplitWidth]);

  // Mobile: tabs
  const [mobileTab, setMobileTab] = useState<'chat' | 'terminal'>('chat');

  return (
    <>
      {/* Desktop split */}
      <div ref={containerRef} className="hidden h-full md:flex">
        {/* Left panel (chat) */}
        <div
          className="h-full overflow-hidden transition-[width] duration-200 ease-out"
          style={{ width: isRightOpen ? `${100 - rightWidth}%` : '100%' }}
        >
          {left}
        </div>

        {/* Drag handle */}
        {isRightOpen && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition hover:bg-purple-500/30"
          >
            <div className="h-8 w-0.5 rounded-full bg-zinc-600 transition group-hover:bg-purple-400" />
          </div>
        )}

        {/* Right panel (terminal) */}
        {isRightOpen && (
          <div
            className="h-full overflow-hidden"
            style={{ width: `${rightWidth}%` }}
          >
            {right}
          </div>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="flex h-full flex-col md:hidden">
        <div className="flex-1 overflow-hidden">
          {(!isRightOpen || mobileTab === 'chat') ? left : right}
        </div>

        {isRightOpen && (
          <div className="flex shrink-0 border-t border-white/5 bg-zinc-950">
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-2.5 text-center text-xs font-medium transition ${
                mobileTab === 'chat'
                  ? 'bg-white/5 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('terminal')}
              className={`flex-1 py-2.5 text-center text-xs font-medium transition ${
                mobileTab === 'terminal'
                  ? 'bg-white/5 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Terminal
            </button>
          </div>
        )}
      </div>
    </>
  );
}
