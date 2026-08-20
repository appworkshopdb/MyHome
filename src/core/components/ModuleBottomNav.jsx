// Die feste "leere" Leiste, die jedes Modul bekommt. Layout/Optik kommt
// komplett aus den globalen .bottom-nav/.nav-item-Klassen (siehe
// styles/layout.css) — ein Modul entscheidet nur noch, welche
// Menüpunkte (items) es bekommt, siehe z.B.
// modules/finance/components/BottomNav.jsx als Vorlage für neue Module.
import { IconHome, IconSummary, IconUtensils, IconDumbbell, IconCheck, IconUserRound } from './Icons';

// Globale Bottom-Nav — NICHT mehr pro Modul, sondern einmal in App.jsx
// gerendert. Wechselt zwischen Start, den vier "Alltags"-Modulen und
// Profil. Kein FAB mehr (siehe BOTTOMNAV_6MODULE.md) — Erfassen
// passiert jetzt innerhalb jedes Moduls selbst (siehe
// core/components/ModuleTabs.jsx für die Unteransicht-Navigation
// INNERHALB eines Moduls, die dadurch hier frei wurde).
//
// Bewusst eine feste, kuratierte Liste statt aller Einträge aus
// core/modules.js — Alltag/Einkauf sind noch reine Platzhalter und
// stehen bewusst nicht in dieser Leiste, auch wenn built:true nur
// zum Testen gesetzt ist (siehe Projektkontext.md, "Status der Module").
const ITEMS = [
  { key: '', label: 'Start', Icon: IconHome },
  { key: 'finance', label: 'Finanzen', Icon: IconSummary },
  { key: 'nutrition', label: 'Ernährung', Icon: IconUtensils },
  { key: 'sport', label: 'Sport', Icon: IconDumbbell },
  { key: 'habits', label: 'Gewohnheiten', Icon: IconCheck },
  { key: 'profile', label: 'Profil', Icon: IconUserRound },
];

export default function ModuleBottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key || 'start'}
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
