// Service Worker für Web Push. Wird von core/lib/pushNotifications.js
// registriert (relativer Pfad "./sw.js", löst unabhängig vom Hash-Teil
// der URL immer zu /MyHome/sw.js auf, siehe Projektkontext.md "Routing").
//
// WICHTIG: Diese Datei läuft NICHT im normalen React-Bundle — kein
// import/export, kein Zugriff auf core/-Module. Reines Browser-API.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Zuhause', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Zuhause';
  const options = {
    body: payload.body || '',
    tag: payload.category || undefined, // gleiche Kategorie ersetzt alte Benachrichtigung statt zu stapeln
    data: { url: payload.url || './' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
