'use client';

import { useEffect } from 'react';
import { useTerminalStore } from '@/lib/terminal-store';
import { useEditorStore } from '@/lib/editor-store';

type IDEState = {
  showFiles: boolean;
  toggleFiles: () => void;
  showTerminal: boolean;
  toggleTerminal: () => void;
  showPreview: boolean;
  togglePreview: () => void;
  ideMode: boolean;
  toggleIdeMode: () => void;
  onQuickOpen: () => void;
};

export function useKeyboardShortcuts(state: IDEState) {
  const saveFile = useEditorStore((s) => s.saveFile);
  const activeFile = useEditorStore((s) => s.activeFile);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+B — toggle file explorer
      if (e.ctrlKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        state.toggleFiles();
        return;
      }

      // Ctrl+J — toggle terminal
      if (e.ctrlKey && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        state.toggleTerminal();
        return;
      }

      // Ctrl+` — toggle terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        state.toggleTerminal();
        return;
      }

      // Ctrl+S — save current file
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (activeFile) saveFile(activeFile);
        return;
      }

      // Ctrl+P — quick open file
      if (e.ctrlKey && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        state.onQuickOpen();
        return;
      }

      // Ctrl+Shift+V — toggle preview panel
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        state.togglePreview();
        return;
      }

      // Ctrl+Shift+I — toggle IDE mode
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        state.toggleIdeMode();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, activeFile, saveFile]);
}
