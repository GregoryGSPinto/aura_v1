'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Fingerprint, Lock, User } from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';
import {
  authenticateBiometric,
  hasSavedCredential,
  isBiometricAvailable,
  registerBiometric,
} from '@/lib/biometric-auth';
import { haptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

function BiometricLoginScreen({ onFallback }: { onFallback: () => void }) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBiometric = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await authenticateBiometric();
      if (token) {
        haptic.success();
        setAuth(token, 'gregory');
        router.replace('/chat');
      } else {
        haptic.error();
        setError('Autenticação falhou.');
      }
    } catch {
      haptic.error();
      setError('Erro na autenticação biométrica.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm animate-fade-in text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
          <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            AURA
          </span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">AI Companion Operacional</p>

        <div className="mt-10">
          <div className="mx-auto flex h-20 w-20 animate-pulse items-center justify-center rounded-full border-2 border-teal-500/30 bg-teal-500/10">
            <Fingerprint className="h-10 w-10 text-teal-400" />
          </div>

          <p className="mt-6 text-sm text-zinc-400">
            Toque para entrar com biometria
          </p>

          <button
            type="button"
            onClick={handleBiometric}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-teal-600 py-3 text-sm font-medium text-white transition hover:bg-teal-500 active:bg-teal-700 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verificando...
              </span>
            ) : (
              '🔐 Face ID / Touch ID'
            )}
          </button>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={onFallback}
            className="mt-4 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ou entre com senha →
          </button>
        </div>
      </div>
    </div>
  );
}

function BiometricOfferModal({
  onActivate,
  onDismiss,
}: {
  onActivate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-center text-lg font-semibold text-zinc-100">
          Ativar Face ID?
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Próxima vez você entra só olhando pro celular.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onActivate}
            className="flex-1 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500"
          >
            Ativar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  const [biometricReady, setBiometricReady] = useState(false);
  const [hasCred, setHasCred] = useState(false);
  const [showBiometricOffer, setShowBiometricOffer] = useState(false);
  const [forceFallback, setForceFallback] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/chat');
  }, [isAuthenticated, router]);

  useEffect(() => {
    const check = async () => {
      const available = await isBiometricAvailable();
      const saved = hasSavedCredential();
      setBiometricReady(available);
      setHasCred(available && saved);
    };
    check();
  }, []);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || isLoading) return;

    setIsLoading(true);
    setError('');

    const success = await login(username, password);

    if (success) {
      // Offer biometric registration if available and not yet registered
      if (biometricReady && !hasSavedCredential()) {
        setShowBiometricOffer(true);
      } else {
        router.replace('/chat');
      }
    } else {
      setError('Credenciais inválidas.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }

    setIsLoading(false);
  };

  const handleBiometricRegister = async () => {
    if (token) {
      await registerBiometric(username, token);
    }
    setShowBiometricOffer(false);
    router.replace('/chat');
  };

  // Show biometric login if credential exists
  if (hasCred && !forceFallback) {
    return <BiometricLoginScreen onFallback={() => setForceFallback(true)} />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              AURA
            </span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">AI Companion Operacional</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            'rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl transition-transform',
            shake && 'animate-shake',
          )}
        >
          {/* Username */}
          <div className="mb-4">
            <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Usuário
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                ref={usernameRef}
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                placeholder="Seu usuário"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="mb-4 text-center text-sm text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className={cn(
              'w-full rounded-lg bg-teal-600 py-3 text-sm font-medium text-white transition',
              isLoading
                ? 'cursor-not-allowed opacity-60'
                : 'hover:bg-teal-500 active:bg-teal-700',
            )}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>

      {/* Biometric offer modal */}
      {showBiometricOffer && (
        <BiometricOfferModal
          onActivate={handleBiometricRegister}
          onDismiss={() => {
            setShowBiometricOffer(false);
            router.replace('/chat');
          }}
        />
      )}
    </div>
  );
}
