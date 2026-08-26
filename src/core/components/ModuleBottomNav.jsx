// Globale Bottom-Nav — 5 Module + 1 Start-Button (zurück zum Hub).
// Der Start-Button ersetzt den gestrichenen "Alltag"-Slot an erster
// Stelle. Er ist aktiv (hervorgehoben), wenn man sich auf dem Hub
// befindet (active === null / active === '').
// Reihenfolge und Kurznamen: bewusste Nutzer-Entscheidung, nicht
// identisch mit den vollen Namen in core/modules.js.
import { IconHome, IconBrain, IconEuro, IconDumbbell, IconUtensils, IconCart } from './Icons';

const MODULE_ITEMS = [
  { key: 'habits',    label: 'Habbits', Icon: IconBrain },
  { key: 'finance',   label: 'Geld',    Icon: IconEuro },
  { key: 'sport',     label: 'Sport',   Icon: IconDumbbell },
  { key: 'nutrition', label: 'Essen',   Icon: IconUtensils },
  { key: 'shopping',  label: 'Einkauf', Icon: IconCart },
];

export default function ModuleBottomNav({ active, onChange }) {
  const isHub = !active || active === '';
  return (
    <nav className="bottom-nav">
      {/* Start-Button — immer an erster Stelle, navigiert zum Hub */}
      <button
        className={`nav-item ${isHub ? 'active' : ''}`}
        onClick={() => onChange('')}
        aria-label="Zum Start"
      >
        <IconHome />
        <span>Start</span>
      </button>

      {MODULE_ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`nav-item ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
