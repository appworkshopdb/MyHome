// src/core/components/ModuleTopBar.jsx
// Schwebende Top-Chrome — drei freistehende Elemente über dem Inhalt.
// position: fixed, liegt über allem, Inhalt scrollt darunter durch.
// Schritt 3 des Umbaus (UMBAU.md / NAVIGATION.md).
//
// Links:  Einstellungs-Button (Zahnrad) → öffnet AppMenu
//         Ausnahme: onBack zeigt Zurück-Pfeil für modul-interne Navigation
// Mitte:  Modulname als nicht-klickbare Anzeige (title-Prop)
// Rechts: Profil-Avatar (Initiale auf --action-primary) → #/profile
//         Warnpunkt in --status-critical wenn hasWarnings

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import AppMenu from '../AppMenu';

// Zahnrad-Icon — 20px, 1.8px Stroke, stroke-linecap: round
function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Zurück-Pfeil — 20px
function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function ModuleTopBar({ title, onBack, hasWarnings }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <>
      {/* Drei freistehende Elemente — kein gemeinsamer Hintergrund */}
      <div className="chrome-top" role="banner">

        {/* Links: Zurück oder Einstellungen */}
        {onBack ? (
          <button
            className="chrome-top-btn"
            onClick={onBack}
            aria-label="Zurück"
          >
            <IconArrowLeft />
          </button>
        ) : (
          <button
            className="chrome-top-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
          >
            <IconGear />
          </button>
        )}

        {/* Mitte: Modulname — kein Knopf */}
        <div className="chrome-top-title" aria-live="polite">
          {title}
        </div>

        {/* Rechts: Profil */}
        <button
          className="chrome-top-btn chrome-top-btn--profile"
          onClick={() => navigate('profile')}
          aria-label={
            hasWarnings
              ? 'Zum Profil — Pflichtdaten unvollständig'
              : 'Zum Profil'
          }
        >
          {initial}
          {hasWarnings && (
            <span className="warn-dot" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* AppMenu — öffnet sich unterhalb der Chrome */}
      {menuOpen && (
        <>
          <div
            className="app-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <AppMenu onClose={() => setMenuOpen(false)} />
        </>
      )}
    </>
  );
}
