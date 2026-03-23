'use client';

import type { DiffHunk } from '@/lib/git-store';
import { cn } from '@/lib/utils';

type DiffViewerProps = {
  file: string;
  hunks: DiffHunk[];
};

export function DiffViewer({ file, hunks }: DiffViewerProps) {
  if (hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-600">No changes in {file}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-zinc-950 font-mono text-sm">
      <div className="sticky top-0 z-10 border-b border-white/5 bg-zinc-900 px-4 py-1.5 text-xs text-zinc-400">
        {file}
      </div>
      {hunks.map((hunk, hi) => (
        <div key={hi} className="border-b border-white/5">
          <div className="bg-zinc-900/50 px-4 py-0.5 text-xs text-blue-400">
            @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
          </div>
          {hunk.lines.map((line, li) => (
            <div
              key={li}
              className={cn(
                'flex leading-6',
                line.type === 'added' && 'bg-green-900/20',
                line.type === 'removed' && 'bg-red-900/20',
              )}
            >
              <span
                className={cn(
                  'w-6 shrink-0 select-none text-center text-xs leading-6',
                  line.type === 'added' && 'text-green-500',
                  line.type === 'removed' && 'text-red-500',
                  line.type === 'context' && 'text-zinc-600',
                )}
              >
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span
                className={cn(
                  'flex-1 whitespace-pre px-2',
                  line.type === 'added' && 'text-green-300',
                  line.type === 'removed' && 'text-red-300',
                  line.type === 'context' && 'text-zinc-400',
                )}
              >
                {line.content}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
