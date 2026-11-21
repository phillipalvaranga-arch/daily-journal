const C = 'journal-v6';
const REM_CACHE = 'dj-reminders';
const F = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'sync.js',
  'reminders.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'icon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(F)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== C && k !== REM_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('__reminder-') !== -1) return;
  if (/\.(png|ico|svg)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request)));
    return;
  }
  // Network-first so app updates show after a refresh, with a cache fallback for offline use.
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(C).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))
    )
  );
});

/* ---------- Reminder alerts ---------- */
const appUrl = () => new URL('./', self.registration.scope).href;

self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  const data = n.data || {};
  const action = e.action || 'open';
  n.close();
  if (action === 'dismiss') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const msg = { type: 'dj-reminder-action', action: action, key: data.key || n.tag, taskId: data.taskId || '', title: n.title, body: n.body };
      const client = list.find((c) => c.url.indexOf(self.registration.scope) === 0) || list[0];
      if (client) {
        client.postMessage(msg);
        if (action === 'open' && 'focus' in client) return client.focus();
        if (action === 'done' && 'focus' in client) return client.focus().catch(() => {});
        return undefined;
      }
      const url = appUrl() + '?remact=' + encodeURIComponent(action) + '&remkey=' + encodeURIComponent(msg.key) + '#today';
      return self.clients.openWindow(url);
    })
  );
});

/* Background check (only where the browser offers Periodic Background Sync to installed apps). */
function ringDue() {
  return caches.open(REM_CACHE).then((c) =>
    Promise.all([c.match('./__reminder-schedule.json'), c.match('./__reminder-swfired.json')]).then((res) =>
      Promise.all([res[0] ? res[0].json() : { items: [], fired: [] }, res[1] ? res[1].json() : {}])
    ).then((vals) => {
      const sched = vals[0] || { items: [] };
      const swFired = vals[1] || {};
      Object.keys(swFired).forEach((k) => { if (Date.now() - new Date(swFired[k]).getTime() > 4 * 86400000) delete swFired[k]; });
      const fired = new Set(sched.fired || []);
      const now = Date.now();
      const due = (sched.items || []).filter((it) => it.due <= now && it.due > now - 60 * 60 * 1000 && !fired.has(it.key) && !swFired[it.key]);
      return Promise.all(due.map((it) => {
        swFired[it.key] = new Date().toISOString();
        const actions = it.taskId
          ? [{ action: 'done', title: '✓ Mark done' }, { action: 'snooze10', title: 'Snooze 10 min' }]
          : [{ action: 'snooze10', title: 'Snooze 10 min' }, { action: 'snooze60', title: 'Snooze 1 hr' }];
        return self.registration.showNotification(it.title, {
          body: it.body, tag: it.key, renotify: true, requireInteraction: true,
          icon: 'icons/icon-192.png', badge: 'icons/favicon.png',
          data: { key: it.key, taskId: it.taskId || '', kind: it.kind || '' }, actions: actions
        });
      })).then(() => c.put('./__reminder-swfired.json', new Response(JSON.stringify(swFired), { headers: { 'Content-Type': 'application/json' } })));
    })
  ).catch(() => {});
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'dj-reminders') e.waitUntil(ringDue());
});
