'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';

export type OpenFile = {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  language: string;
  modified: boolean;
};

type EditorStoreState = {
  openFiles: OpenFile[];
  activeFile: string | null;
  cursorLine: number;
  cursorCol: number;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<boolean>;
  saveAll: () => Promise<void>;
  setCursor: (line: number, col: number) => void;
};

async function apiFetch<T = Record<string, unknown>>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  const url = `${prefix}${endpoint}`;

  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    },
    cache: 'no-store',
  });

  return res.json();
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set, get) => ({
      openFiles: [],
      activeFile: null,
      cursorLine: 1,
      cursorCol: 1,

      openFile: async (path: string) => {
        const state = get();
        // Already open? Just activate
        const existing = state.openFiles.find((f) => f.path === path);
        if (existing) {
          set({ activeFile: path });
          return;
        }

        // Fetch from API
        try {
          const data = await apiFetch<{ success: boolean; data: { path: string; name: string; content: string; language: string; size: number } }>(`/files/read?path=${encodeURIComponent(path)}`);
          if (!data.success) return;

          const file: OpenFile = {
            path: data.data.path,
            name: data.data.name,
            content: data.data.content,
            originalContent: data.data.content,
            language: data.data.language,
            modified: false,
          };

          set({
            openFiles: [...state.openFiles, file],
            activeFile: path,
            cursorLine: 1,
            cursorCol: 1,
          });
        } catch {
          // silently fail
        }
      },

      closeFile: (path: string) => {
        const state = get();
        const newFiles = state.openFiles.filter((f) => f.path !== path);
        const newActive =
          state.activeFile === path
            ? newFiles[newFiles.length - 1]?.path ?? null
            : state.activeFile;
        set({ openFiles: newFiles, activeFile: newActive });
      },

      setActiveFile: (path: string) => set({ activeFile: path, cursorLine: 1, cursorCol: 1 }),

      updateContent: (path: string, content: string) => {
        set((state) => ({
          openFiles: state.openFiles.map((f) =>
            f.path === path
              ? { ...f, content, modified: content !== f.originalContent }
              : f,
          ),
        }));
      },

      saveFile: async (path: string) => {
        const state = get();
        const file = state.openFiles.find((f) => f.path === path);
        if (!file || !file.modified) return true;

        try {
          const data = await apiFetch<{ success: boolean; data: { path: string; saved: boolean } }>('/files/write', {
            method: 'POST',
            body: JSON.stringify({ path: file.path, content: file.content }),
          });

          if (data.success) {
            set((s) => ({
              openFiles: s.openFiles.map((f) =>
                f.path === path
                  ? { ...f, modified: false, originalContent: f.content }
                  : f,
              ),
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      saveAll: async () => {
        const state = get();
        for (const file of state.openFiles) {
          if (file.modified) {
            await get().saveFile(file.path);
          }
        }
      },

      setCursor: (line: number, col: number) => set({ cursorLine: line, cursorCol: col }),
    }),
    {
      name: 'aura-editor-store',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      partialize: (state) => ({
        activeFile: state.activeFile,
        // Don't persist file contents — reload on open
      }),
    },
  ),
);
