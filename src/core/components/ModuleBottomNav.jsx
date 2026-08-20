// Die feste "leere" Leiste, die jedes Modul bekommt. Layout/Optik kommt
// komplett aus den globalen .bottom-nav/.nav-item-Klassen (siehe
// styles/layout.css) — ein Modul entscheidet nur noch, welche
// Menüpunkte (items) es bekommt, siehe z.B.
// modules/finance/components/BottomNav.jsx als Vorlage für neue Module.
import { IconHome, IconBrain, IconEuro, IconDumbbell, IconUtensils, IconCart } from './Icons';

// Globale Bottom-Nav — zeigt jetzt alle 6 Module direkt (kein Start/
// Profil mehr hier, die sitzen seit ModuleTopBar.jsx oben links/rechts
// auf jedem Screen). Reihenfolge und Kurznamen sind eine bewusste
// Nutzer-Entscheidung, nicht identisch mit den vollen Modulnamen aus
// core/modules.js (dort z.B. "Sport", hier "Sport" für "Training" –
// aber "Gewohnheiten"→"Habbits", "Finanzen"→"Geld", "Ernährung"→"Essen").
const ITEMS = [
  { key: 'everyday', label: 'Alltag', Icon: IconHome },
  { key: 'habits', label: 'Habbits', Icon: IconBrain },
  { key: 'finance', label: 'Geld', Icon: IconEuro },
  { key: 'sport', label: 'Sport', Icon: IconDumbbell },
  { key: 'nutrition', label: 'Essen', Icon: IconUtensils },
  { key: 'shopping', label: 'Einkauf', Icon: IconCart },
];

export default function ModuleBottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ key, label, Icon }) => (
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
