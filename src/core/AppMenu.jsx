import { useUi } from './lib/UiContext';
import { MODES } from './lib/theme';

// Konto/Profil (jetzt direkter Avatar-Button in AppHeader) und Module
// (jetzt die 2×2-Kachelgrid direkt im Hub) sind hier bewusst raus —
// dieses Dropdown ist nur noch für Einstellungen da, aktuell einzig
// der Design-Modus. Weitere Einstellungen kämen hier als zusätzliche
// Sektion dazu, ohne Konto/Module wieder mit reinzunehmen.
export default function AppMenu() {
  const { mode, setMode } = useUi();

  return (
    <div className="app-menu">
      <div className="app-menu-heading">Einstellungen</div>

      <div className="app-menu-section-label">Design</div>
      <div className="mode-toggle">
        {MODES.map((m) => (
          <button key={m.key} className={m.key === mode ? 'active' : ''} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
