import { useState } from 'react';
import { useAuth } from './lib/AuthContext';
import AppMenu from './AppMenu';
import { IconChevronDown } from './components/Icons';

// Nur auf dem Hub sichtbar (App.jsx rendert AppHeader ausschließlich
// wenn activeModule === null) — Module/Profil nutzen stattdessen
// ModuleTopBar.jsx mit Home-Icon links. Hier links dagegen ein
// Dropdown (kein Navigationsziel, man ist ja schon zuhause) für
// Design/Einstellungen; rechts wie überall der direkte Profil-Zugang.
export default function AppHeader({ onNavigate, hasWarnings }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (session?.user?.email || '?').charAt(0).toUpperCase();

  return (
    <header className="app-header">
      <button
        className="module-topbar-home"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
      >
        <IconChevronDown />
      </button>

      <div className="module-topbar-title">Zuhause</div>

      <button
        className="module-topbar-avatar"
        onClick={() => onNavigate('profile')}
        aria-label={hasWarnings ? 'Zum Profil — Pflichtdaten unvollständig' : 'Zum Profil'}
      >
        {initial}
        {hasWarnings && <span className="app-menu-toggle-alert" aria-hidden="true" />}
      </button>

      {open && (
        <>
          <div className="app-menu-backdrop" onClick={() => setOpen(false)} />
          <AppMenu />
        </>
      )}
    </header>
  );
}
