// src/core/components/ModuleTopBar.jsx
// Schwebende Top-Chrome — zwei Elemente über dem Inhalt: links ein
// freistehender Button, rechts EINE zusammenhängende Pille mit zwei
// Tippflächen. position: fixed, liegt über allem, Inhalt scrollt darunter.
//
// Links:  Einstellungs-Button (Zahnrad) → öffnet AppMenu
//         Ausnahme: onBack zeigt Zurück-Pfeil für modul-interne Navigation
//         (Detail-Screens innerhalb eines Bereichs) — NUR der linke Button
//         wechselt, die rechte Pille bleibt unverändert bestehen.
// Mitte:  Titel — NUR sichtbar wenn onBack gesetzt ist (Detail-Screen),
//         sonst kein Titel (Übersichten haben keinen). title-Prop wird
//         dafür seit Schritt 4 (UMBAU-PLAN.md) wieder ausgewertet.
//         Zentriert im verfügbaren Raum zwischen Zurück-Button und Pille
//         — NICHT exakt auf die volle Bildschirmbreite bezogen, weil die
//         Pille (anders als ein einzelner 36px-Button) breiter ist. Das
//         weicht von der ursprünglichen README-Vorgabe "36px Ausgleich
//         rechts" ab, die von einer verschwindenden Pille ausging — hier
//         bewusst angepasst, weil die Pille laut Vorgabe bestehen bleibt.
// Rechts: EINE Pille (`.chrome-top-right`), zwei Tippflächen getrennt durch
//         eine Haarlinie: GamificationBadges (Vogel+Level, Nest+Streak,
//         öffnet GamificationSheet) und Profil-Avatar (Initiale auf
//         --action-primary) → #/profile, Warnpunkt bei fehlenden
//         Pflichtdaten. Bleibt auf JEDER Modul-Hauptansicht UND jedem
//         Detail-Screen sichtbar — verschwindet nur hinter dem Backdrop
//         eines offenen FAB-Sheets (SheetShell deckt den ganzen Screen ab),
//         nicht beim reinen Navigieren in einen Bereich.
//
// Auf Modul-Übersichten (kein onBack) gibt es keinen Titel — die Bottom-
// Nav zeigt bereits, in welchem Modul man ist. Auf Detail-Screens (onBack
// gesetzt) steht der Bereichsname mittig zwischen den beiden Chrome-
// Elementen.

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import AppMenu from '../AppMenu';
import GamificationBadges from './GamificationBadges.jsx';

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

export default function ModuleTopBar({ onBack, title, hasWarnings }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <>
      {/* Links: freistehender Button. Mitte: Titel (nur Detail-Screens).
          Rechts: eine zusammenhängende Pille. */}
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

        {/* Mitte: Titel — nur auf Detail-Screens (onBack gesetzt) */}
        {onBack && title && (
          <div className="chrome-top-title">{title}</div>
        )}

        {/* Rechts: EIN Element, zwei Tippflächen — Gamification links,
            Profil rechts hinter einer Haarlinie. Beide bleiben auch auf
            Detail-Screens sichtbar (onBack ändert nur den linken Button). */}
        <div className="chrome-top-right">
          <GamificationBadges />

          <span className="chrome-top-divider" aria-hidden="true" />

          <button
            className="chrome-top-profile-zone"
            onClick={() => navigate('profile')}
            aria-label={
              hasWarnings
                ? 'Zum Profil — Pflichtdaten unvollständig'
                : 'Zum Profil'
            }
          >
            <span className="chrome-top-avatar">
              {initial}
              {hasWarnings && (
                <span className="warn-dot" aria-hidden="true" />
              )}
            </span>
          </button>
        </div>
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
