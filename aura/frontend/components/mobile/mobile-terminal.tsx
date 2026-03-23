'use client';

import dynamic from 'next/dynamic';
import { haptic } from '@/hooks/use-haptic';

const TerminalPanel = dynamic(
  () => import('@/components/terminal/terminal-panel').then((m) => ({ default: m.TerminalPanel })),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-zinc-600 text-sm">Carregando terminal...</div> },
);

const QUICK_COMMANDS = [
  'git status', 'git pull', 'npm test', 'clear', 'cd ..', 'ls -la',
];

export function MobileTerminal() {
  return (
    <div className="flex h-full flex-col">
      {/* Quick commands */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/5 bg-zinc-900 px-3 py-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => haptic.light()}
            className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-400 active:bg-zinc-700 active:text-zinc-200"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden">
        <TerminalPanel />
      </div>
    </div>
  );
}
