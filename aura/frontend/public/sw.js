const CACHE_NAME = 'aura-v2';
const SHELL_URLS = ['/', '/chat', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// Push Notifications with Actions
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Aura', body: 'Nova notificação' };

  let actions = [];
  switch (data.tag) {
    case 'morning-briefing':
      actions = [
        { action: 'open-chat', title: '💬 Ver detalhes' },
        { action: 'dismiss', title: '✕ Dispensar' },
      ];
      break;
    case 'health-alert':
      actions = [
        { action: 'open-dashboard', title: '📊 Dashboard' },
        { action: 'dismiss', title: '✕ OK' },
      ];
      break;
    case 'task-complete':
      actions = [
        { action: 'open-chat', title: '💬 Ver resultado' },
        { action: 'open-terminal', title: '>_ Terminal' },
      ];
      break;
    case 'git-push':
      actions = [
        { action: 'open-chat', title: '💬 Status' },
        { action: 'run-tests', title: '▶️ Rodar testes' },
      ];
      break;
    default:
      actions = [
        { action: 'open-chat', title: '💬 Abrir' },
      ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Aura', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'aura-default',
      actions,
      data: { url: data.url || '/chat', apiUrl: data.apiUrl, token: data.token },
      vibrate: data.urgent ? [200, 100, 200] : [100],
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  let url = '/chat';
  switch (action) {
    case 'open-dashboard':
      url = '/dashboard';
      break;
    case 'open-terminal':
      url = '/chat?tab=terminal';
      break;
    case 'run-tests':
      // Fire-and-forget test command via API
      if (data.apiUrl && data.token) {
        fetch(`${data.apiUrl}/api/v1/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`,
          },
          body: JSON.stringify({ command: 'pytest', params: {} }),
        }).catch(() => {});
      }
      url = '/chat?tab=terminal';
      break;
    case 'dismiss':
      return;
    default:
      url = data.url || '/chat';
  }

  event.waitUntil(clients.openWindow(url));
});
