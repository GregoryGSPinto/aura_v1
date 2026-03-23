'use client';

import { useEffect, useState } from 'react';

import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { CodeEditor } from '@/components/editor/code-editor';
import { FileExplorer } from '@/components/editor/file-explorer';
import { PreviewPanel } from '@/components/editor/preview-panel';
import { IDELayout } from '@/components/layout/ide-layout';
import { SplitView } from '@/components/layout/split-view';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { useTerminalStore } from '@/lib/terminal-store';

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const val = localStorage.getItem(key);
  return val !== null ? val === 'true' : fallback;
}

export default function ChatPage() {
  const isTerminalOpen = useTerminalStore((s) => s.isOpen);
  const [ideMode, setIdeMode] = useState(false);

  // Load from localStorage after hydration
  useEffect(() => {
    setIdeMode(loadBool('aura-ide-mode', false));
  }, []);

  // Persist
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura-ide-mode', String(ideMode));
    }
  }, [ideMode]);

  // Listen for Ctrl+Shift+I to toggle IDE mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setIdeMode((m) => !m);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Expose toggle for TopBar
  useEffect(() => {
    const w = window as Window & { __auraIdeMode?: boolean; __auraToggleIdeMode?: () => void };
    w.__auraIdeMode = ideMode;
    w.__auraToggleIdeMode = () => setIdeMode((m) => !m);
  }, [ideMode]);

  if (ideMode) {
    return (
      <IDELayout
        fileExplorer={<FileExplorer />}
        editor={<CodeEditor />}
        chat={<ChatWorkspace />}
        terminal={<TerminalPanel />}
        preview={<PreviewPanel />}
      />
    );
  }

  return (
    <SplitView
      left={<ChatWorkspace />}
      right={<TerminalPanel />}
      isRightOpen={isTerminalOpen}
    />
  );
}
