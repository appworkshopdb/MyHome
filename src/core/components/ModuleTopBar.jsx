// src/core/components/ModuleTopBar.jsx
// Schwebende Kopfzeile über dem Inhalt (position: fixed, Inhalt scrollt darunter).
//
// Hub (status):        Zahnrad links, rechts EINE Pille mit Level/Serie (GamificationBadges)
//                      und Profilbild. Level und Serie stehen sonst nur noch im Profil.
// Modul-Startseite:    Zahnrad links, rechts nur das Profilbild.
// Detail-Screen:       Zurück links, Titel mittig mit voller Breite, rechts höchstens eine
//                      Aktion (action) – so wird der Titel auch bei 320 px nicht abgeschnitten.
// Fixed-Nav-Regel: keine transform/filter an Vorfahren von .chrome-top.

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import AppMenu from '../AppMenu';
import GamificationBadges from './GamificationBadges.jsx';
import { useAvatar } from '../lib/avatarData';
import Icon from './Icon.jsx';

// Redesign (26.11.2026): Level und Serie stehen nur noch im Hub (status) – und im Profil
// selbst. Detail-Screens bekommen die ruhige Kopfzeile: Zurück links, Titel mittig mit
// voller Breite, höchstens EINE Aktion rechts (action: { icon, label, onClick }).
// Modul-Startseiten: Zahnrad links, rechts nur das Profilbild.
export default function ModuleTopBar({ onBack, title, hasWarnings, status = false, action }) {
  const { session } = useAuth();
  const { module: routeModule, navigate } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const avatar = useAvatar(session);
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  const profileLabel = hasWarnings ? 'Zum Profil — Pflichtdaten unvollständig' : 'Zum Profil';
  const avatarEl = (
    <span className="chrome-top-avatar">
      {avatar ? <img className="chrome-top-avatar-img" src={avatar} alt="" /> : initial}
      {hasWarnings && <span className="warn-dot" aria-hidden="true" />}
    </span>
  );

  return (
    <>
      {/* Links: freistehender Button. Mitte: Titel (nur Detail-Screens).
          Rechts: eine zusammenhängende Pille. */}
      {onBack ? (
        <div className="chrome-top chrome-top--detail" role="banner">
          <button className="chrome-top-btn" onClick={onBack} aria-label="Zurück">
            <Icon name="back" size={22} />
          </button>
          <div className="chrome-top-title">{title}</div>
          {action ? (
            <button className="chrome-top-btn" onClick={action.onClick} aria-label={action.label} title={action.label}>
              <Icon name={action.icon} size={22} />
            </button>
          ) : (
            <span className="chrome-top-spacer" aria-hidden="true" />
          )}
        </div>
      ) : (
        <div className="chrome-top" role="banner">
          <button
            className="chrome-top-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
          >
            <Icon name="settings" size={22} />
          </button>

          {status ? (
            <div className="chrome-top-right">
              <GamificationBadges />
              <span className="chrome-top-divider" aria-hidden="true" />
              <button
                className="chrome-top-profile-zone"
                onClick={() => navigate('profile')}
                aria-current={routeModule === 'profile' ? 'page' : undefined}
                aria-label={profileLabel}
              >
                {avatarEl}
              </button>
            </div>
          ) : (
            <button
              className="chrome-top-btn chrome-top-solo"
              onClick={() => navigate('profile')}
              aria-current={routeModule === 'profile' ? 'page' : undefined}
              aria-label={profileLabel}
            >
              {avatarEl}
            </button>
          )}
        </div>
      )}

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
