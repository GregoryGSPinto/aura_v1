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
        style={{ background: 'radial-gradient(ellipse at 50% 40%, var(--login-glow) 0%, transparent 70%)' }}
      />

      {/* Orbital rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        {/* Ring 1 */}
        <div
          className="absolute rounded-full login-ring"
          style={{ width: 400, height: 400, '--ring-duration': '60s', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--login-ring-1)' } as React.CSSProperties}
        />
        {/* Ring 2 */}
        <div
          className="absolute rounded-full login-ring"
          style={{ width: 600, height: 600, '--ring-duration': '90s', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--login-ring-2)' } as React.CSSProperties}
        />
        {/* Ring 3 (reverse) */}
        <div
          className="absolute rounded-full login-ring"
          style={{ width: 800, height: 800, '--ring-duration': '120s', animationDirection: 'reverse', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--login-ring-3)' } as React.CSSProperties}
        />

        {/* Orbital dots */}
        <div
          className="absolute login-ring"
          style={{ width: 400, height: 400, '--ring-duration': '60s' } as React.CSSProperties}
        >
          <div
            className="absolute left-1/2 top-0 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ background: 'var(--login-dot-1)' }}
          />
        </div>
        <div
          className="absolute login-ring"
          style={{ width: 600, height: 600, '--ring-duration': '90s' } as React.CSSProperties}
        >
          <div
            className="absolute bottom-0 left-1/4 h-[3px] w-[3px] rounded-full"
            style={{ background: 'var(--login-dot-2)' }}
          />
        </div>
        <div
          className="absolute login-ring"
          style={{ width: 800, height: 800, '--ring-duration': '120s', animationDirection: 'reverse' } as React.CSSProperties}
        >
          <div
            className="absolute right-[15%] top-1/4 h-[3px] w-[3px] rounded-full"
            style={{ background: 'var(--login-dot-3)' }}
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
      style={{ background: 'var(--login-page-bg)' }}
    >
      <OrbitalBackground />

      <div className="relative z-10 flex w-full flex-col items-center" style={{ maxWidth: 320 }}>
        {/* Symbol */}
        <span
          className="login-symbol mb-4 text-[56px] leading-none animate-pulse-subtle"
          style={{ color: 'var(--login-symbol-color)', filter: 'var(--login-symbol-glow)' }}
        >
          ✦
        </span>

        {/* Title */}
        <h1
          className="login-title mb-1 text-[36px] font-extralight tracking-[12px]"
          style={{ color: 'var(--login-title-color)' }}
        >
          AURA
        </h1>

        {/* Subtitle */}
        <p
          className="login-subtitle mb-12 font-mono text-[11px] lowercase tracking-[4px]"
          style={{ color: 'var(--login-subtitle-color)' }}
        >
          autonomous ai agent
        </p>

        {/* Biometric button */}
        <div className="login-form w-full text-center">
          <button
            type="button"
            onClick={handleBiometric}
            disabled={loading}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:opacity-60"
            style={{
              background: 'var(--login-bio-btn-bg)',
              border: '1px solid var(--login-bio-btn-border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--login-bio-hover-border)';
              e.currentTarget.style.boxShadow = 'var(--login-bio-hover-shadow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--login-bio-btn-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {loading ? (
              <span
                className="h-6 w-6 animate-spin rounded-full"
                style={{ border: '2px solid var(--login-bio-spinner-track)', borderTopColor: 'var(--login-bio-spinner-active)' }}
              />
            ) : (
              <Fingerprint className="h-10 w-10" style={{ color: 'var(--login-symbol-color)' }} />
            )}
          </button>

          <p className="text-sm" style={{ color: 'var(--login-bio-text)' }}>
            Toque para entrar com biometria
          </p>

          {error && (
            <div
              className="login-error mx-auto mt-4 max-w-xs rounded-lg p-3 text-xs"
              style={{
                background: 'var(--login-error-bg)',
                border: '1px solid var(--login-error-border)',
                color: 'var(--login-error-text)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onFallback}
            className="mt-6 text-sm transition"
            style={{ color: 'var(--login-link-color)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--login-link-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--login-link-color)'; }}
          >
            ou entre com senha
          </button>
        </div>
      </div>

      {/* Tagline */}
      <p
        className="login-tagline absolute text-xs italic"
        style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)', color: 'var(--login-tagline-color)' }}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'var(--login-modal-overlay)' }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'var(--login-modal-bg)',
          border: '1px solid var(--login-modal-border)',
        }}
      >
        <h2 className="text-center text-lg font-light tracking-wide" style={{ color: 'var(--login-modal-title)' }}>
          Ativar Face ID?
        </h2>
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--login-modal-text)' }}>
          Proxima vez voce entra so olhando pro celular.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onActivate}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-medium tracking-[2px] uppercase transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'var(--login-btn-bg)', color: 'var(--login-btn-text)' }}
          >
            Ativar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-xl py-2.5 text-sm transition hover:bg-white/5"
            style={{ border: '1px solid var(--login-modal-dismiss-border)', color: 'var(--login-modal-dismiss-text)' }}
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
    background: 'var(--login-input-bg)',
    border: '1px solid var(--login-input-border)',
    color: 'var(--login-input-text)',
    fontSize: 16, // prevent Safari zoom
  } as const;

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: 'var(--login-page-bg)' }}
    >
      <OrbitalBackground />

      {/* Content */}
      <div className="relative z-10 flex w-full flex-col items-center" style={{ maxWidth: 320 }}>
        {/* Symbol */}
        <span
          className="login-symbol mb-4 text-[56px] leading-none animate-pulse-subtle"
          style={{ color: 'var(--login-symbol-color)', filter: 'var(--login-symbol-glow)' }}
        >
          ✦
        </span>

        {/* Title */}
        <h1
          className="login-title mb-1 text-[36px] font-extralight tracking-[12px]"
          style={{ color: 'var(--login-title-color)' }}
        >
          AURA
        </h1>

        {/* Subtitle */}
        <p
          className="login-subtitle mb-12 font-mono text-[11px] lowercase tracking-[4px]"
          style={{ color: 'var(--login-subtitle-color)' }}
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
              style={{ color: 'var(--login-input-icon)' }}
            />
            <input
              ref={usernameRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 w-full rounded-xl pl-11 pr-4 text-sm outline-none transition-all duration-200"
              style={{
                ...inputStyle,
                '--tw-placeholder-color': 'var(--login-input-placeholder)',
              } as React.CSSProperties}
              placeholder="Usuario"
              autoComplete="username"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--login-focus-border)';
                e.currentTarget.style.boxShadow = 'var(--login-focus-shadow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--login-input-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-[14px] top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--login-input-icon)' }}
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl pl-11 pr-11 text-sm outline-none transition-all duration-200"
              style={inputStyle}
              placeholder="Senha"
              autoComplete="current-password"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--login-focus-border)';
                e.currentTarget.style.boxShadow = 'var(--login-focus-shadow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--login-input-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition"
              style={{ color: 'var(--login-input-icon)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--login-link-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--login-input-icon)'; }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="!mt-5 h-12 w-full rounded-xl text-[13px] font-medium uppercase tracking-[3px] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--login-btn-bg)', color: 'var(--login-btn-text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--login-btn-glow)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full"
                  style={{ border: '2px solid var(--login-btn-spinner-track)', borderTopColor: 'var(--login-btn-spinner-active)' }}
                />
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
                background: 'var(--login-error-bg)',
                border: '1px solid var(--login-error-border)',
                color: 'var(--login-error-text)',
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
        style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)', color: 'var(--login-tagline-color)' }}
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
