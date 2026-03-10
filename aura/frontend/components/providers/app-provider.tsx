'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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
    }),
    [notifications, resolvedTheme, themeMode, visuals]
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
