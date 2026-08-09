import { useUi } from './lib/UiContext';
import { MODES } from './lib/theme';
import { MODULES } from './modules';
import { IconHome, IconLock, IconChevronRight } from './components/Icons';

export default function AppMenu({ activeModule, onNavigate }) {
  const { mode, setMode } = useUi();

  return (
    <div className="app-menu">
      <div className="app-menu-section-label">Design</div>
      <div className="mode-toggle">
        {MODES.map((m) => (
          <button key={m.key} className={m.key === mode ? 'active' : ''} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="app-menu-section-label">Module</div>

      <button
        className={`app-menu-row ${activeModule === null ? 'active' : ''}`}
        onClick={() => onNavigate(null)}
      >
        <span className="app-menu-row-label"><IconHome /> Start</span>
      </button>

      {MODULES.map((m) => (
        <button
          key={m.id}
          className={`app-menu-row ${activeModule === m.id ? 'active' : ''}`}
          onClick={() => onNavigate(m.id)}
          title={m.built ? m.name : `${m.name} — noch nicht verfügbar`}
        >
          <span className="app-menu-row-label">
            <span className="hub-module-dot" style={{ background: m.color }} />
            {m.name}
          </span>
          {m.built ? <IconChevronRight /> : <IconLock />}
        </button>
      ))}
    </div>
  );
}
