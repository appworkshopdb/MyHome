import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import { IconChevronDown, IconBack } from './Icons';
import AppMenu from '../AppMenu';

// Einheitliche obere Leiste für ALLE Screens — Hub, Profil und jedes Modul.
// Ersetzt den früheren AppHeader vollständig; AppHeader.jsx wird nicht
// mehr in App.jsx eingebunden.
//
// Links:  Einstellungs-Dropdown (Chevron) → öffnet AppMenu
//         Ausnahme: onBack (optional) zeigt stattdessen einen Zurück-Pfeil,
//         für modul-interne Unternavigation (z.B. Liste → Detail).
// Mitte:  title-Prop — "Zuhause" auf dem Hub, Modul-/Tab-Name in Modulen.
// Rechts: Profil-Avatar → #/profile
//         Warnpunkt (blauer Punkt), wenn hasWarnings === true.
export default function ModuleTopBar({ title, onBack, hasWarnings }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="module-topbar">
      {onBack ? (
        <button className="module-topbar-home" onClick={onBack} aria-label="Zurück">
          <IconBack />
        </button>
      ) : (
        <button
          className="module-topbar-home"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
        >
          <IconChevronDown />
        </button>
      )}

      <div className="module-topbar-title">{title}</div>

      <button
        className="module-topbar-profile"
        onClick={() => navigate('profile')}
        aria-label={hasWarnings ? 'Zum Profil — Pflichtdaten unvollständig' : 'Zum Profil'}
        style={{ position: 'relative' }}
      >
        <span className="module-topbar-avatar">{initial}</span>
        {hasWarnings && <span className="app-menu-toggle-alert" aria-hidden="true" />}
      </button>

      {menuOpen && (
        <>
          <div className="app-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <AppMenu />
        </>
      )}
    </div>
  );
}
