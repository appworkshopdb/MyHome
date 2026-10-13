// src/core/components/ModuleBottomNav.jsx
// Schwebende Bottom-Nav — eine Leiste, sechs Punkte.
// Schritt 3 des Umbaus (UMBAU.md / NAVIGATION.md).
//
// Reihenfolge: Hub · Gewohnheiten · Finanzen · Sport · Ernährung · Einkauf
// Aktiver Punkt: Pille (--action-primary) mit Symbol 17px + Label 11px/700
// Inaktive Punkte: nur Symbol 19px in --nav-item-idle-fg, flex: 1
//
// Symbole als Strichzeichnung, 1.8px stroke, stroke-linecap: round.
// Vollnamen durchgehend ("Gewohnheiten" statt "Habbits").
// aria-current="page" am aktiven Punkt.

import { ModuleIcon } from './ModuleIcons';

// ── SVG-Icons (Strichzeichnung, kein Emoji) ───────────────────────────
// Die Zeichnungen leben in ModuleIcons.jsx (auch von Wizard und Touren genutzt).
const IcoHub       = () => <ModuleIcon id="hub" size={19} />;
const IcoHabits    = () => <ModuleIcon id="habits" size={19} />;
const IcoFinance   = () => <ModuleIcon id="finance" size={19} />;
const IcoSport     = () => <ModuleIcon id="sport" size={19} />;
const IcoNutrition = () => <ModuleIcon id="nutrition" size={19} />;
const IcoShopping  = () => <ModuleIcon id="shopping" size={19} />;

// ── Nav-Items ─────────────────────────────────────────────────────────
const ITEMS = [
  { key: '',          label: 'Hub',          Icon: IcoHub      },
  { key: 'habits',    label: 'Gewohnheiten', Icon: IcoHabits   },
  { key: 'finance',   label: 'Finanzen',     Icon: IcoFinance  },
  { key: 'sport',     label: 'Sport',        Icon: IcoSport    },
  { key: 'nutrition', label: 'Ernährung',    Icon: IcoNutrition},
  { key: 'shopping',  label: 'Einkauf',      Icon: IcoShopping },
];

export default function ModuleBottomNav({ active, onChange }) {
  // active === null oder '' = Hub
  const current = active ?? '';

  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = current === key;
        return (
          <button
            key={key}
            className={`nav-item${isActive ? ' active' : ''}`}
            onClick={() => onChange(key)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
