import { useCallback, useEffect, useState } from 'react';

// Schema: #/               → Hub
//         #/profile        → Profil
//         #/<moduleId>            → Modul, eigene Default-Unteransicht
//         #/<moduleId>/<view>     → Modul, konkrete Unteransicht
//
// Hash-Routing statt "sauberer" Pfade: GitHub Pages liefert bei einem
// Reload auf einer Unterseite ohne Server-Konfiguration einen echten
// 404 zurück (kein SPA-Rewrite). Der Teil nach "#" verlässt den Browser
// nie — ein Reload fragt immer nur "/MyHome/" an, das existiert immer.
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [moduleId, ...rest] = raw.split('/').filter(Boolean);
  return { module: moduleId || null, view: rest.join('/') || null };
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // path: null/''/undefined → Hub. 'profile' → Profil. 'finance' oder
  // 'finance/summary' → Modul (+ Unteransicht). Ein Aufruf reicht überall,
  // wo bisher setActiveModule(id) stand — die Signatur ist unverändert.
  const navigate = useCallback((path) => {
    window.location.hash = path ? `/${path}` : '/';
  }, []);

  return { module: route.module, view: route.view, navigate };
}
