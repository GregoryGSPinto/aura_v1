import { clientEnv } from './env';
import { useAuthStore } from './auth-store';

function getApiPrefix(): string {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

function getHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token || clientEnv.auraToken;
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    // 1. Get VAPID key from backend
    const prefix = getApiPrefix();
    const res = await fetch(`${prefix}/push/vapid-key`, { headers: getHeaders() });
    const json = await res.json();
    const vapidKey = json.data?.public_key;
    if (!vapidKey) return false;

    // 2. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // 3. Get push subscription from SW
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    // 4. Send subscription to backend
    const subJson = subscription.toJSON();
    await fetch(`${prefix}/push/subscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        expirationTime: subJson.expirationTime ?? null,
      }),
    });

    return true;
  } catch (err) {
    console.error('[PushService] Subscribe failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    await subscription.unsubscribe();

    const prefix = getApiPrefix();
    await fetch(`${prefix}/push/unsubscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    return true;
  } catch {
    return false;
  }
}
