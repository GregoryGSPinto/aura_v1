'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DevicePreview = 'mobile' | 'tablet' | 'desktop';

export type ActivePort = {
  port: number;
  status: number;
  type: string;
};

type PreviewStoreState = {
  isOpen: boolean;
  targetUrl: string;
  device: DevicePreview;
  autoRefresh: boolean;
  refreshKey: number;
  activePorts: ActivePort[];
  togglePreview: () => void;
  setOpen: (open: boolean) => void;
  setTargetUrl: (url: string) => void;
  setDevice: (device: DevicePreview) => void;
  setAutoRefresh: (on: boolean) => void;
  triggerRefresh: () => void;
  setActivePorts: (ports: ActivePort[]) => void;
};

export const usePreviewStore = create<PreviewStoreState>()(
  persist(
    (set) => ({
      isOpen: false,
      targetUrl: 'http://localhost:3000',
      device: 'desktop',
      autoRefresh: true,
      refreshKey: 0,
      activePorts: [],

      togglePreview: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setTargetUrl: (url) => set({ targetUrl: url }),
      setDevice: (device) => set({ device }),
      setAutoRefresh: (on) => set({ autoRefresh: on }),
      triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
      setActivePorts: (ports) => set({ activePorts: ports }),
    }),
    {
      name: 'aura-preview-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isOpen: state.isOpen,
        targetUrl: state.targetUrl,
        device: state.device,
        autoRefresh: state.autoRefresh,
      }),
    },
  ),
);
