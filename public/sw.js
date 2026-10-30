/* Service worker del panel (ámbito /admin): avisos push y página sin conexión. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;padding:40px 20px;text-align:center;color:#111"><h1>Sin conexión</h1><p>Ahora mismo no hay internet. Vuelve a intentarlo en un momento.</p><p><a href="/admin">Reintentar</a></p></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titulo: 'Panel', cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Panel', {
    body: d.cuerpo || '',
    icon: '/admin/icono-192.png',
    badge: '/admin/badge-96.png',
    tag: d.tag || 'aviso',
    renotify: true,
    data: { url: d.url || '/admin/mensajes' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) { c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
