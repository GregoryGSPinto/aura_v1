'use client';

const CREDENTIAL_KEY = 'aura_webauthn_credential_id';

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasSavedCredential(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(CREDENTIAL_KEY);
}

function getApiBase(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function registerBiometric(username: string, token: string): Promise<boolean> {
  try {
    const base = getApiBase();

    // 1. Get registration options
    const optionsRes = await fetch(`${base}/auth/webauthn/register-options`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!optionsRes.ok) return false;
    const options = await optionsRes.json();

    // 2. Create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: base64UrlToBuffer(options.challenge),
        rp: { name: options.rp_name, id: options.rp_id },
        user: {
          id: base64UrlToBuffer(options.user_id),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    const response = credential.response as AuthenticatorAttestationResponse;

    // 3. Send to backend
    const registerRes = await fetch(`${base}/auth/webauthn/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        credential_id: bufferToBase64Url(credential.rawId),
        attestation_object: bufferToBase64Url(response.attestationObject),
        client_data_json: bufferToBase64Url(response.clientDataJSON),
      }),
    });

    if (!registerRes.ok) return false;

    // 4. Save credential ID locally
    localStorage.setItem(CREDENTIAL_KEY, bufferToBase64Url(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function authenticateBiometric(): Promise<string | null> {
  try {
    const base = getApiBase();
    const credentialId = localStorage.getItem(CREDENTIAL_KEY);
    if (!credentialId) return null;

    // 1. Get login options
    const optionsRes = await fetch(`${base}/auth/webauthn/login-options`);
    if (!optionsRes.ok) return null;
    const options = await optionsRes.json();

    // 2. Get credential
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToBuffer(options.challenge),
        rpId: options.rp_id,
        allowCredentials: [
          {
            id: base64UrlToBuffer(credentialId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return null;

    const response = credential.response as AuthenticatorAssertionResponse;

    // 3. Verify with backend
    const loginRes = await fetch(`${base}/auth/webauthn/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential_id: bufferToBase64Url(credential.rawId),
        authenticator_data: bufferToBase64Url(response.authenticatorData),
        client_data_json: bufferToBase64Url(response.clientDataJSON),
        signature: bufferToBase64Url(response.signature),
      }),
    });

    if (!loginRes.ok) return null;
    const data = await loginRes.json();
    return data.data?.token ?? null;
  } catch {
    return null;
  }
}

export function clearBiometricCredential() {
  localStorage.removeItem(CREDENTIAL_KEY);
}
