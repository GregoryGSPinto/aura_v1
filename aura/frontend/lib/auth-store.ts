'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const TOKEN_COOKIE_NAME = 'aura_token';

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

type AuthState = {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setAuth: (token: string, username: string) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      isAuthenticated: false,

      login: async (username: string, password: string): Promise<boolean> => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8000';
          const base = apiUrl.replace(/\/+$/, '');
          const url = base.endsWith('/api/v1')
            ? `${base}/auth/login`
            : `${base}/api/v1/auth/login`;

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) return false;

          const data = await response.json();
          if (!data.success || !data.data?.token) return false;

          const token = data.data.token;
          const user = data.data.username;

          setCookie(TOKEN_COOKIE_NAME, token);
          set({ token, username: user, isAuthenticated: true });
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        deleteCookie(TOKEN_COOKIE_NAME);
        set({ token: null, username: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      setAuth: (token: string, username: string) => {
        setCookie(TOKEN_COOKIE_NAME, token);
        set({ token, username, isAuthenticated: true });
      },
    }),
    {
      name: 'aura-auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        username: state.username,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
