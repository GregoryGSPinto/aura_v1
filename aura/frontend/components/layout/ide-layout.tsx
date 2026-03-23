'use client';

/**
 * IDE Layout — 4 paineis redimensionaveis.
 *
 * +---------+------------------+---------+
 * |  Files  |    Editor        |  Chat   |
 * |  Tree   |    (tabs)        | (Aura)  |
 * |         +------------------+         |
 * |         |    Terminal      |         |
 * +---------+------------------+---------+
 *
 * Each separator is draggable.
 * Each panel can be opened/closed.
 * State persisted in localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Code2,
  FolderTree,
  GitBranch,
  Globe,
  MessageSquareText,
  SquareTerminal,
} from 'lucide-react';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useGitStore } from '@/lib/git-store';
import { usePreviewStore } from '@/lib/preview-store';
import { useTerminalStore } from '@/lib/terminal-store';
import { cn } from '@/lib/utils';

type IDELayoutProps = {
  fileExplorer: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
  terminal: ReactNode;
  preview: ReactNode;
  gitPanel: ReactNode;
};

// localStorage helpers
function loadNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const val = localStorage.getItem(key);
  return val ? Number(val) : fallback;
}
function saveNumber(key: string, val: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, String(val));
}
function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const val = localStorage.getItem(key);
  return val !== null ? val === 'true' : fallback;
}
function saveBool(key: string, val: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, String(val));
}

export function IDELayout({ fileExplorer, editor, chat, terminal, preview, gitPanel }: IDELayoutProps) {
  const [showFiles, setShowFiles] = useState(() => loadBool('ide-show-files', true));
  const [showChat] = useState(() => loadBool('ide-show-chat', true));
  const showTerminal = useTerminalStore((s) => s.isOpen);
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);
  const showPreview = usePreviewStore((s) => s.isOpen);
  const togglePreview = usePreviewStore((s) => s.togglePreview);
  const showGit = useGitStore((s) => s.isOpen);
  const toggleGit = useGitStore((s) => s.toggleGit);

  const [filesWidth, setFilesWidth] = useState(() => loadNumber('ide-files-w', 200));
  const [chatWidth, setChatWidth] = useState(() => loadNumber('ide-chat-w', 320));
  const [terminalHeight, setTerminalHeight] = useState(() => loadNumber('ide-term-h', 200));

  const [dragging, setDragging] = useState<'files' | 'chat' | 'terminal' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist
  useEffect(() => { saveBool('ide-show-files', showFiles); }, [showFiles]);
  useEffect(() => { saveBool('ide-show-chat', showChat); }, [showChat]);
  useEffect(() => { saveNumber('ide-files-w', filesWidth); }, [filesWidth]);
  useEffect(() => { saveNumber('ide-chat-w', chatWidth); }, [chatWidth]);
  useEffect(() => { saveNumber('ide-term-h', terminalHeight); }, [terminalHeight]);

  // Quick open callback (shows file explorer search)
  const [, setQuickOpen] = useState(false);
  const onQuickOpen = useCallback(() => {
    setShowFiles(true);
    setQuickOpen((q) => !q);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    showFiles,
    toggleFiles: () => setShowFiles((s) => !s),
    showTerminal,
    toggleTerminal,
    showPreview,
    togglePreview,
    showGit,
    toggleGit,
    ideMode: true,
    toggleIdeMode: () => {},
    onQuickOpen,
  });

  // Drag handlers
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (dragging === 'files') {
        const w = Math.min(400, Math.max(140, e.clientX - rect.left));
        setFilesWidth(w);
      } else if (dragging === 'chat') {
        const w = Math.min(500, Math.max(240, rect.right - e.clientX));
        setChatWidth(w);
      } else if (dragging === 'terminal') {
        const h = Math.min(500, Math.max(100, rect.bottom - e.clientY));
        setTerminalHeight(h);
      }
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor =
        dragging === 'terminal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Mobile tabs
  const [mobileTab, setMobileTab] = useState<'chat' | 'files' | 'editor' | 'terminal' | 'preview' | 'git'>('chat');

  return (
    <>
      {/* Desktop */}
      <div ref={containerRef} className="hidden h-full md:flex">
        {/* Files panel */}
        {showFiles && (
          <>
            <div className="h-full overflow-hidden" style={{ width: filesWidth }}>
              {fileExplorer}
            </div>
            <div
              onMouseDown={() => setDragging('files')}
              className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition hover:bg-blue-500/30"
            >
              <div className="h-8 w-0.5 rounded-full bg-zinc-700 transition group-hover:bg-blue-400" />
            </div>
          </>
        )}

        {/* Git panel */}
        {showGit && (
          <>
            <div className="h-full overflow-hidden" style={{ width: 260 }}>
              {gitPanel}
            </div>
            <div className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition hover:bg-purple-500/30">
              <div className="h-8 w-0.5 rounded-full bg-zinc-700 transition group-hover:bg-purple-400" />
            </div>
          </>
        )}

        {/* Center: Editor + Preview + Terminal */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Editor + Preview */}
          <div className="flex flex-1 overflow-hidden">
            <div className={cn('overflow-hidden', showPreview ? 'flex-1' : 'flex-1')}>
              {editor}
            </div>
            {showPreview && (
              <>
                <div
                  className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition hover:bg-green-500/30"
                >
                  <div className="h-8 w-0.5 rounded-full bg-zinc-700 transition group-hover:bg-green-400" />
                </div>
                <div className="flex-1 overflow-hidden">
                  {preview}
                </div>
              </>
            )}
          </div>

          {/* Terminal handle */}
          {showTerminal && (
            <div
              onMouseDown={() => setDragging('terminal')}
              className="group relative z-10 flex h-1 shrink-0 cursor-row-resize items-center justify-center bg-white/5 transition hover:bg-purple-500/30"
            >
              <div className="h-0.5 w-8 rounded-full bg-zinc-700 transition group-hover:bg-purple-400" />
            </div>
          )}

          {/* Terminal */}
          {showTerminal && (
            <div className="overflow-hidden" style={{ height: terminalHeight }}>
              {terminal}
            </div>
          )}
        </div>

        {/* Chat handle */}
        {showChat && (
          <div
            onMouseDown={() => setDragging('chat')}
            className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition hover:bg-purple-500/30"
          >
            <div className="h-8 w-0.5 rounded-full bg-zinc-700 transition group-hover:bg-purple-400" />
          </div>
        )}

        {/* Chat panel */}
        {showChat && (
          <div className="h-full overflow-hidden" style={{ width: chatWidth }}>
            {chat}
          </div>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="flex h-full flex-col md:hidden">
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'chat' && chat}
          {mobileTab === 'files' && fileExplorer}
          {mobileTab === 'editor' && editor}
          {mobileTab === 'terminal' && terminal}
          {mobileTab === 'preview' && preview}
          {mobileTab === 'git' && gitPanel}
        </div>

        <div className="flex shrink-0 border-t border-white/5 bg-zinc-950">
          {[
            { id: 'chat' as const, label: 'Chat', icon: MessageSquareText },
            { id: 'files' as const, label: 'Files', icon: FolderTree },
            { id: 'editor' as const, label: 'Editor', icon: Code2 },
            { id: 'terminal' as const, label: 'Term', icon: SquareTerminal },
            { id: 'preview' as const, label: 'Preview', icon: Globe },
            { id: 'git' as const, label: 'Git', icon: GitBranch },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition',
                  mobileTab === tab.id
                    ? 'bg-white/5 text-zinc-200'
                    : 'text-zinc-500',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
