'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/lib/editor-store';
import { useTerminalStore } from '@/lib/terminal-store';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { useChatStore } from '@/lib/chat-store';

type IDEState = {
  showFiles: boolean;
  toggleFiles: () => void;
  showTerminal: boolean;
  toggleTerminal: () => void;
  showPreview: boolean;
  togglePreview: () => void;
  showGit: boolean;
  toggleGit: () => void;
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

      // Ctrl+Shift+G — toggle git panel
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        state.toggleGit();
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

export function useGlobalShortcuts() {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const toggleCommandPalette = useWorkspaceStore((s) => s.toggleCommandPalette);
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);
  const createConversation = useChatStore((s) => s.createConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const saveFile = useEditorStore((s) => s.saveFile);
  const activeFile = useEditorStore((s) => s.activeFile);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      // Ctrl+K — command palette (works even in text fields)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Escape — close overlays
      if (e.key === 'Escape') {
        useWorkspaceStore.getState().setCommandPaletteOpen(false);
        return;
      }

      if (isTyping) return;

      // Ctrl+1-5 — workspace presets
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const wsMap: Record<string, string> = {
          '1': 'chat',
          '2': 'code',
          '3': 'monitor',
          '4': 'review',
          '5': 'focus',
        };
        if (wsMap[e.key]) {
          e.preventDefault();
          setWorkspace(wsMap[e.key]);
          return;
        }
      }

      // Ctrl+B — toggle sidebar
      if (e.ctrlKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
        return;
      }

      // Ctrl+N — new chat
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        const id = createConversation();
        setActiveConversation(id);
        return;
      }

      // Ctrl+J — toggle terminal
      if (e.ctrlKey && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        toggleTerminal();
        return;
      }

      // Ctrl+` — toggle terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
        return;
      }

      // Ctrl+S — save file
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (activeFile) saveFile(activeFile);
        return;
      }

      // Ctrl+Shift+P — command palette (alternative)
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    activeFile,
    createConversation,
    saveFile,
    setActiveConversation,
    setSidebarCollapsed,
    setWorkspace,
    sidebarCollapsed,
    toggleCommandPalette,
    toggleTerminal,
  ]);
}
