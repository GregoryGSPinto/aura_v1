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

/* ── Orbital rings background (shared) ─────────────────── */
function OrbitalBackground() {
  return (
    <>
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,212,170,0.04) 0%, transparent 70%)' }}
      />

      {/* Orbital rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        {/* Ring 1 */}
        <div
          className="absolute rounded-full border border-[rgba(0,212,170,0.03)] login-ring"
          style={{ width: 400, height: 400, '--ring-duration': '60s' } as React.CSSProperties}
        />
        {/* Ring 2 */}
        <div
          className="absolute rounded-full border border-[rgba(0,212,170,0.02)] login-ring"
          style={{ width: 600, height: 600, '--ring-duration': '90s' } as React.CSSProperties}
        />
        {/* Ring 3 (reverse) */}
        <div
          className="absolute rounded-full border border-[rgba(0,212,170,0.015)] login-ring"
          style={{ width: 800, height: 800, '--ring-duration': '120s', animationDirection: 'reverse' } as React.CSSProperties}
        />

        {/* Orbital dots */}
        <div
          className="absolute login-ring"
          style={{ width: 400, height: 400, '--ring-duration': '60s' } as React.CSSProperties}
        >
          <div
            className="absolute left-1/2 top-0 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ background: 'rgba(0,212,170,0.2)' }}
          />
        </div>
        <div
          className="absolute login-ring"
          style={{ width: 600, height: 600, '--ring-duration': '90s' } as React.CSSProperties}
        >
          <div
            className="absolute bottom-0 left-1/4 h-[3px] w-[3px] rounded-full"
            style={{ background: 'rgba(0,212,170,0.12)' }}
          />
        </div>
        <div
          className="absolute login-ring"
          style={{ width: 800, height: 800, '--ring-duration': '120s', animationDirection: 'reverse' } as React.CSSProperties}
        >
          <div
            className="absolute right-[15%] top-1/4 h-[3px] w-[3px] rounded-full"
            style={{ background: 'rgba(0,212,170,0.1)' }}
          />
        </div>
      </div>
    </>
  );
}

/* ── Biometric login screen ────────────────────────────── */
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
        setError('Autenticacao falhou.');
      }
    } catch {
      haptic.error();
      setError('Erro na autenticacao biometrica.');
    }
    setLoading(false);
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: '#0A0E1A' }}
    >
      <OrbitalBackground />

      <div className="relative z-10 flex w-full flex-col items-center" style={{ maxWidth: 320 }}>
        {/* Symbol */}
        <span
          className="login-symbol mb-4 text-[56px] leading-none animate-pulse-subtle"
          style={{ color: '#00D4AA', filter: 'drop-shadow(0 0 40px rgba(0,212,170,0.2))' }}
        >
          ✦
        </span>

        {/* Title */}
        <h1
          className="login-title mb-1 text-[36px] font-extralight tracking-[12px]"
          style={{ color: 'rgba(255,255,255,0.9)' }}
        >
          AURA
        </h1>

        {/* Subtitle */}
        <p
          className="login-subtitle mb-12 font-mono text-[11px] lowercase tracking-[4px]"
          style={{ color: 'rgba(0,212,170,0.4)' }}
        >
          autonomous ai agent
        </p>

        {/* Biometric button */}
        <div className="login-form w-full text-center">
          <button
            type="button"
            onClick={handleBiometric}
            disabled={loading}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(0,212,170,0.2)] transition-all duration-200 hover:border-[rgba(0,212,170,0.4)] hover:shadow-[0_0_30px_rgba(0,212,170,0.15)] active:scale-95 disabled:opacity-60"
            style={{ background: 'rgba(0,212,170,0.08)' }}
          >
            {loading ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(0,212,170,0.3)] border-t-[#00D4AA]" />
            ) : (
              <Fingerprint className="h-10 w-10" style={{ color: '#00D4AA' }} />
            )}
          </button>

          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Toque para entrar com biometria
          </p>

          {error && (
            <div
              className="login-error mx-auto mt-4 max-w-xs rounded-lg p-3 text-xs"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgb(239,68,68)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onFallback}
            className="mt-6 text-sm transition hover:text-white/40"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            ou entre com senha
          </button>
        </div>
      </div>

      {/* Tagline */}
      <p
        className="login-tagline absolute text-xs italic"
        style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)', color: 'rgba(255,255,255,0.12)' }}
      >
        devolvendo tempo a familia
      </p>
    </div>
  );
}

/* ── Biometric offer modal ─────────────────────────────── */
function BiometricOfferModal({
  onActivate,
  onDismiss,
}: {
  onActivate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-xs rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'rgba(17,24,39,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 className="text-center text-lg font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Ativar Face ID?
        </h2>
        <p className="mt-2 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Proxima vez voce entra so olhando pro celular.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onActivate}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-medium tracking-[2px] uppercase transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{ background: '#00D4AA', color: '#0A0E1A' }}
          >
            Ativar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-xl py-2.5 text-sm transition hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
          >
            Agora nao
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main login page ───────────────────────────────────── */
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
      setError('Credenciais invalidas.');
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

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16, // prevent Safari zoom
  } as const;

  const inputFocusClass = 'focus:border-[rgba(0,212,170,0.3)] focus:shadow-[0_0_0_3px_rgba(0,212,170,0.08)]';

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: '#0A0E1A' }}
    >
      <OrbitalBackground />

      {/* Content */}
      <div className="relative z-10 flex w-full flex-col items-center" style={{ maxWidth: 320 }}>
        {/* Symbol */}
        <span
          className="login-symbol mb-4 text-[56px] leading-none animate-pulse-subtle"
          style={{ color: '#00D4AA', filter: 'drop-shadow(0 0 40px rgba(0,212,170,0.2))' }}
        >
          ✦
        </span>

        {/* Title */}
        <h1
          className="login-title mb-1 text-[36px] font-extralight tracking-[12px]"
          style={{ color: 'rgba(255,255,255,0.9)' }}
        >
          AURA
        </h1>

        {/* Subtitle */}
        <p
          className="login-subtitle mb-12 font-mono text-[11px] lowercase tracking-[4px]"
          style={{ color: 'rgba(0,212,170,0.4)' }}
        >
          autonomous ai agent
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={cn('login-form w-full space-y-3', shake && 'animate-shake')}
        >
          {/* Username */}
          <div className="relative">
            <User
              className="pointer-events-none absolute left-[14px] top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            />
            <input
              ref={usernameRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn('h-12 w-full rounded-xl pl-11 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-white/20', inputFocusClass)}
              style={inputStyle}
              placeholder="Usuario"
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-[14px] top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn('h-12 w-full rounded-xl pl-11 pr-11 text-sm outline-none transition-all duration-200 placeholder:text-white/20', inputFocusClass)}
              style={inputStyle}
              placeholder="Senha"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:text-white/40"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="!mt-5 h-12 w-full rounded-xl text-[13px] font-medium uppercase tracking-[3px] transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_30px_rgba(0,212,170,0.2)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: '#00D4AA', color: '#0A0E1A' }}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A0E1A]/30 border-t-[#0A0E1A]" />
                <span className="text-[11px] tracking-[2px]">AUTENTICANDO...</span>
              </span>
            ) : (
              'CONECTAR'
            )}
          </button>

          {/* Error */}
          {error && (
            <div
              className="login-error mt-2 rounded-lg p-3 text-xs"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgb(239,68,68)',
              }}
            >
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Tagline */}
      <p
        className="login-tagline absolute text-xs italic"
        style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)', color: 'rgba(255,255,255,0.12)' }}
      >
        devolvendo tempo a familia
      </p>

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
