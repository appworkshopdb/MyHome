import { MODULES } from './modules';

export default function ModuleRegister({ active, onChange }) {
  return (
    <nav className="module-register" aria-label="Module">
      {MODULES.map((m) => (
        <button
          key={m.id}
          className={`module-tab ${active === m.id ? 'active' : ''}`}
          style={{ '--tab-color': m.color }}
          onClick={() => onChange(m.id)}
          aria-current={active === m.id}
          title={m.built ? m.name : `${m.name} — noch nicht verfügbar`}
        >
          {m.name}
        </button>
      ))}
    </nav>
  );
}
