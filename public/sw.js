// Service Worker für Web Push UND Asset-Caching. Wird von
// core/lib/pushNotifications.js registriert (relativer Pfad "./sw.js",
// löst unabhängig vom Hash-Teil der URL immer zu /MyHome/sw.js auf,
// siehe Projektkontext.md "Routing").
//
// WICHTIG: Diese Datei läuft NICHT im normalen React-Bundle — kein
// import/export, kein Zugriff auf core/-Module. Reines Browser-API.
//
// ── Caching-Strategie ────────────────────────────────────────────────
// Erst ab hier gilt die App als offline-fähig; vorher hatte der Worker
// nur Push-Handler und Chrome bot deshalb kein "Installieren" an.
//
//   Navigation (die HTML-Seite)  → Network-first, Cache als Notfall.
//     Muss so herum sein: index.html enthält die Verweise auf die
//     gehashten Asset-Dateien. Käme sie aus dem Cache, würde nach einem
//     Deploy die alte App geladen, obwohl neue Dateien bereitliegen.
//
//   /assets/*  → Cache-first. Diese Namen enthalten einen Inhalts-Hash
//     (index-B_APMmuh.js), ändern sich also bei jeder Änderung mit.
//     Was einmal unter dem Namen im Cache liegt, ist für immer korrekt.
//
//   Bilder, Sounds, Icons, Manifest → Stale-while-revalidate. Namen sind
//     hier NICHT gehasht (trizeps.webp), also sofort aus dem Cache
//     ausliefern und im Hintergrund still erneuern.
//
//   Alles andere, insbesondere Supabase → gar nicht anfassen. API-
//     Antworten dürfen nie aus einem Cache kommen.
//
// CACHE_VERSION bei Änderungen an dieser Datei hochzählen. Beim Aktivieren
// werden alle Caches mit anderem Namen gelöscht.

const CACHE_VERSION = 'v2';
const CACHE_NAME = `zuhause-${CACHE_VERSION}`;

// Minimal halten: gehashte Assets kennt der Worker zur Installationszeit
// nicht (die Namen ändern sich bei jedem Build), sie landen beim ersten
// Aufruf über die fetch-Regeln unten im Cache.
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      // Ein einzelner fehlender Eintrag darf die Installation nicht kippen
      .catch((err) => console.warn('[sw] Shell nicht vollständig gecacht:', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n.startsWith('zuhause-') && n !== CACHE_NAME)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Nur vollständige, eigene 200er-Antworten sind cachebar. Teilantworten
// (HTTP 206, z.B. bei Range-Requests von <audio>/<video>) lehnt die
// Cache-API ab und wirft dabei eine unbehandelte Ablehnung — genau das
// ist beim ersten Deploy in der Konsole aufgeschlagen.
function darfGecachtWerden(antwort) {
  return antwort && antwort.ok && antwort.status === 200 && antwort.type === 'basic';
}

function lege(request, antwort) {
  if (!darfGecachtWerden(antwort)) return;
  const kopie = antwort.clone();
  caches.open(CACHE_NAME)
    .then((c) => c.put(request, kopie))
    .catch(() => { /* Cache voll oder Antwort nicht speicherbar — egal */ });
}

function istAsset(url) {
  return url.pathname.includes('/assets/');
}

function istStatischesPublic(url) {
  return /\/(images|sounds|icons)\//.test(url.pathname) || url.pathname.endsWith('/manifest.json');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Range-Requests (Teilbereiche einer Datei) nie abfangen — die Antwort
  // waere ein 206 und im Cache nicht speicherbar.
  if (request.headers.has('range')) return;

  const url = new URL(request.url);
  // Fremde Hosts (Supabase, Google Fonts) unangetastet lassen
  if (url.origin !== self.location.origin) return;

  // 1. Seitenaufruf/Reload
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((antwort) => {
          lege('./index.html', antwort);
          return antwort;
        })
        .catch(() => caches.match('./index.html').then((treffer) => treffer || Response.error()))
    );
    return;
  }

  // 2. Gehashte Build-Dateien
  if (istAsset(url)) {
    event.respondWith(
      caches.match(request).then((treffer) => treffer || fetch(request).then((antwort) => {
        lege(request, antwort);
        return antwort;
      }))
    );
    return;
  }

  // 3. Statische Dateien mit festem Namen
  if (istStatischesPublic(url)) {
    event.respondWith(
      caches.match(request).then((treffer) => {
        const frisch = fetch(request).then((antwort) => {
          lege(request, antwort);
          return antwort;
        }).catch(() => treffer);
        return treffer || frisch;
      })
    );
  }
  // 4. Rest: keine respondWith-Antwort — der Browser macht es selbst
});


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
