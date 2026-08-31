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

// ── SVG-Icons (Strichzeichnung, kein Emoji) ───────────────────────────
const s = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' };

function IcoHub() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IcoHabits() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IcoFinance() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IcoSport() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IcoNutrition() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function IcoShopping() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...s}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

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
