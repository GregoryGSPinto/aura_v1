'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WorkspaceId = 'chat' | 'code' | 'monitor' | 'review' | 'focus' | (string & {});

export type WorkspaceLayoutConfig = {
  leftSidebar: 'expanded' | 'collapsed' | 'hidden';
  rightContext: 'expanded' | 'collapsed' | 'hidden';
  fileExplorer: boolean;
  editor: boolean;
  terminal: boolean;
  preview: boolean;
  chat: 'main' | 'side-panel' | 'hidden';
  splitRatio?: number[];
};

export type WorkspacePreset = {
  id: string;
  name: string;
  icon: string;
  description: string;
  layout: WorkspaceLayoutConfig;
  custom?: boolean;
};

export const WORKSPACE_PRESETS: Record<string, WorkspacePreset> = {
  chat: {
    id: 'chat',
    name: 'Conversa',
    icon: '💬',
    description: 'Foco total na conversa com a Aura',
    layout: {
      leftSidebar: 'collapsed',
      rightContext: 'collapsed',
      fileExplorer: false,
      editor: false,
      terminal: false,
      preview: false,
      chat: 'main',
    },
  },
  code: {
    id: 'code',
    name: 'Código',
    icon: '💻',
    description: 'Editor + Terminal + Chat lateral',
    layout: {
      leftSidebar: 'collapsed',
      rightContext: 'hidden',
      fileExplorer: true,
      editor: true,
      terminal: true,
      preview: false,
      chat: 'side-panel',
      splitRatio: [15, 50, 35],
    },
  },
  monitor: {
    id: 'monitor',
    name: 'Monitor',
    icon: '📊',
    description: 'Dashboard + Chat + Logs do terminal',
    layout: {
      leftSidebar: 'collapsed',
      rightContext: 'expanded',
      fileExplorer: false,
      editor: false,
      terminal: true,
      preview: false,
      chat: 'main',
    },
  },
  review: {
    id: 'review',
    name: 'Review',
    icon: '🔍',
    description: 'Git diff + Editor + Preview',
    layout: {
      leftSidebar: 'collapsed',
      rightContext: 'collapsed',
      fileExplorer: true,
      editor: true,
      terminal: false,
      preview: true,
      chat: 'side-panel',
      splitRatio: [15, 40, 25, 20],
    },
  },
  focus: {
    id: 'focus',
    name: 'Foco',
    icon: '🎯',
    description: 'Só o chat. Sem distrações.',
    layout: {
      leftSidebar: 'hidden',
      rightContext: 'hidden',
      fileExplorer: false,
      editor: false,
      terminal: false,
      preview: false,
      chat: 'main',
    },
  },
};

type WorkspaceStoreState = {
  activeWorkspace: WorkspaceId;
  activePanel: string;
  commandPaletteOpen: boolean;
  customWorkspaces: WorkspacePreset[];
  setWorkspace: (id: WorkspaceId) => void;
  setActivePanel: (panel: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  saveCurrentAsPreset: (name: string, icon: string) => void;
  deleteCustomPreset: (id: string) => void;
  getActivePreset: () => WorkspacePreset;
};

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set, get) => ({
      activeWorkspace: 'chat' as WorkspaceId,
      activePanel: 'chat',
      commandPaletteOpen: false,
      customWorkspaces: [] as WorkspacePreset[],

      setWorkspace: (id) => {
        const preset =
          WORKSPACE_PRESETS[id] ?? get().customWorkspaces.find((w) => w.id === id);
        const defaultPanel = preset?.layout.chat === 'main' ? 'chat' : 'editor';
        set({ activeWorkspace: id, activePanel: defaultPanel });
      },

      setActivePanel: (panel) => set({ activePanel: panel }),

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      saveCurrentAsPreset: (name, icon) => {
        const active = get().getActivePreset();
        const newPreset: WorkspacePreset = {
          ...active,
          id: `custom-${Date.now()}`,
          name,
          icon,
          custom: true,
        };
        set((s) => ({ customWorkspaces: [...s.customWorkspaces, newPreset] }));
      },

      deleteCustomPreset: (id) =>
        set((s) => ({
          customWorkspaces: s.customWorkspaces.filter((w) => w.id !== id),
          activeWorkspace: s.activeWorkspace === id ? 'chat' : s.activeWorkspace,
        })),

      getActivePreset: () => {
        const state = get();
        return (
          WORKSPACE_PRESETS[state.activeWorkspace] ??
          state.customWorkspaces.find((w) => w.id === state.activeWorkspace) ??
          WORKSPACE_PRESETS.chat
        );
      },
    }),
    {
      name: 'aura-workspace',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      partialize: (state) => ({
        activeWorkspace: state.activeWorkspace,
        customWorkspaces: state.customWorkspaces,
      }),
    },
  ),
);
