import { useState } from 'react';
import AppMenu from './AppMenu';
import { IconMenu, IconClose } from './components/Icons';

export default function AppHeader({ activeModule, onNavigate }) {
  const [open, setOpen] = useState(false);

  function navigate(id) {
    onNavigate(id);
    setOpen(false);
  }

  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-brand-dot" />
        Zuhause
      </div>
      <button
        className="app-menu-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>

      {open && (
        <>
          <div className="app-menu-backdrop" onClick={() => setOpen(false)} />
          <AppMenu activeModule={activeModule} onNavigate={navigate} />
        </>
      )}
    </header>
  );
}
