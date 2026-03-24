'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TerminalLine = {
  id: string;
  type: 'input' | 'output' | 'prompt' | 'system';
  content: string;
  source?: 'user' | 'aura';
};

type TerminalStoreState = {
  isOpen: boolean;
  splitWidth: number;
  lines: TerminalLine[];
  history: string[];
  historyIndex: number;
  cwd: string;
  connected: boolean;
  toggleTerminal: () => void;
  setOpen: (open: boolean) => void;
  setSplitWidth: (width: number) => void;
  addLine: (line: Omit<TerminalLine, 'id'>) => void;
  clearLines: () => void;
  setCwd: (cwd: string) => void;
  setConnected: (connected: boolean) => void;
  addHistory: (command: string) => void;
  setHistoryIndex: (index: number) => void;
  injectOutput: (command: string, output: string) => void;
};

let lineCounter = 0;
function nextLineId() {
  return `tl-${++lineCounter}-${Date.now()}`;
}

export const useTerminalStore = create<TerminalStoreState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      splitWidth: 40,
      lines: [],
      history: [],
      historyIndex: -1,
      cwd: '~',
      connected: false,

      toggleTerminal: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setSplitWidth: (width) => set({ splitWidth: width }),

      addLine: (line) =>
        set((s) => ({
          lines: [...s.lines, { ...line, id: nextLineId() }].slice(-500),
        })),

      clearLines: () => set({ lines: [] }),

      setCwd: (cwd) => set({ cwd }),
      setConnected: (connected) => set({ connected }),

      addHistory: (command) =>
        set((s) => ({
          history: [...s.history, command].slice(-100),
          historyIndex: -1,
        })),

      setHistoryIndex: (index) => set({ historyIndex: index }),

      injectOutput: (command, output) => {
        const state = get();
        const lines: Omit<TerminalLine, 'id'>[] = [
          { type: 'input', content: command, source: 'aura' },
          { type: 'output', content: output },
        ];
        set({
          lines: [
            ...state.lines,
            ...lines.map((l) => ({ ...l, id: nextLineId() })),
          ].slice(-500),
        });
      },
    }),
    {
      name: 'aura-terminal-store',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      partialize: (state) => ({
        isOpen: state.isOpen,
        splitWidth: state.splitWidth,
      }),
    },
  ),
);
