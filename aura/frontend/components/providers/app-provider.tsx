'use client';

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchStatus, fetchVoiceStatus } from '@/lib/api';
import type { StatusPayload, VoiceStatusPayload } from '@/lib/types';

type ThemeMode = 'light' | 'dark' | 'system';

type NotificationPreferences = {
  push: boolean;
  email: boolean;
  agentUpdates: boolean;
  systemAlerts: boolean;
};

type VisualPreferences = {
  particles: boolean;
  animations: boolean;
  transparency: boolean;
};

type AuraPreferencesContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  notifications: NotificationPreferences;
  setNotifications: (value: NotificationPreferences) => void;
  visuals: VisualPreferences;
  setVisuals: (value: VisualPreferences) => void;
  runtimeStatus: StatusPayload | null;
  voiceStatus: VoiceStatusPayload | null;
  refreshRuntime: () => Promise<void>;
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  push: true,
  email: false,
  agentUpdates: true,
  systemAlerts: true,
};

const DEFAULT_VISUALS: VisualPreferences = {
  particles: true,
  animations: true,
  transparency: true,
};

const THEME_STORAGE_KEY = 'aura-theme-mode';
const NOTIFICATION_STORAGE_KEY = 'aura-notification-preferences';
const VISUAL_STORAGE_KEY = 'aura-visual-preferences';

const AuraPreferencesContext = createContext<AuraPreferencesContextValue | null>(null);

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [notifications, setNotificationsState] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [visuals, setVisualsState] = useState<VisualPreferences>(DEFAULT_VISUALS);
  const [runtimeStatus, setRuntimeStatus] = useState<StatusPayload | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatusPayload | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const nextTheme = storedTheme ?? 'system';
    const nextNotifications = readStoredValue(NOTIFICATION_STORAGE_KEY, DEFAULT_NOTIFICATIONS);
    const nextVisuals = readStoredValue(VISUAL_STORAGE_KEY, DEFAULT_VISUALS);

    setThemeModeState(nextTheme);
    setNotificationsState(nextNotifications);
    setVisualsState(nextVisuals);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const nextResolved = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode;
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(nextResolved);
      root.style.colorScheme = nextResolved;
      setResolvedTheme(nextResolved);
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeMode]);

  const refreshRuntime = useCallback(async () => {
    try {
      const [statusResponse, voiceResponse] = await Promise.all([fetchStatus(), fetchVoiceStatus()]);
      setRuntimeStatus(statusResponse.data);
      setVoiceStatus(voiceResponse.data);
    } catch {
      setRuntimeStatus((current) =>
        current
          ? {
              ...current,
              status: 'offline',
              services: {
                ...current.services,
                api: 'offline',
              },
            }
          : null,
      );
      setVoiceStatus((current) =>
        current
          ? {
              ...current,
              pipeline_ready: false,
            }
          : null,
      );
    }
  }, []);

  useEffect(() => {
    void refreshRuntime();
    const timer = window.setInterval(() => {
      void refreshRuntime();
    }, 20000);

    return () => window.clearInterval(timer);
  }, [refreshRuntime]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  };

  const setNotifications = (value: NotificationPreferences) => {
    setNotificationsState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(value));
    }
  };

  const setVisuals = (value: VisualPreferences) => {
    setVisualsState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(value));
    }
  };

  const contextValue = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      notifications,
      setNotifications,
      visuals,
      setVisuals,
      runtimeStatus,
      voiceStatus,
      refreshRuntime,
    }),
    [notifications, refreshRuntime, resolvedTheme, runtimeStatus, themeMode, visuals, voiceStatus]
  );

  return <AuraPreferencesContext.Provider value={contextValue}>{children}</AuraPreferencesContext.Provider>;
}

export function useAuraPreferences() {
  const context = useContext(AuraPreferencesContext);
  if (!context) {
    throw new Error('useAuraPreferences must be used within AppProvider');
  }
  return context;
}
