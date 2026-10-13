// core/components/ModuleIcons.jsx
// Die Bereichs-Symbole der Bottom-Nav (ModuleBottomNav.jsx) an EINER Stelle,
// damit Touren, Wizard und Nav dieselben Zeichnungen zeigen. Strichzeichnung,
// Farbe über currentColor.
//
// id: hub | habits | finance | sport | nutrition | shopping

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export function ModuleIcon({ id, size = 19, strokeWidth = 1.8 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...stroke, strokeWidth, 'aria-hidden': true };
  switch (id) {
    case 'habits':
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...common}>
          <path d="M18 6.5A8 8 0 1 0 18 17.5" />
          <line x1="4" y1="10" x2="13" y2="10" />
          <line x1="4" y1="14" x2="13" y2="14" />
        </svg>
      );
    case 'sport':
      return (
        <svg {...common}>
          <path d="M6.5 6.5v11" />
          <path d="M17.5 6.5v11" />
          <path d="M4 9v6" />
          <path d="M20 9v6" />
          <line x1="6.5" y1="12" x2="17.5" y2="12" />
        </svg>
      );
    case 'nutrition':
      return (
        <svg {...common}>
          <path d="M2.4 5v3.4a1.5 1.5 0 0 0 3 0V5" />
          <path d="M3.9 9.9V19" />
          <circle cx="12" cy="12" r="5.2" />
          <path d="M21 19V5c-1.4.8-2.2 2.4-2.2 4.4 0 1 .6 1.6 1.4 1.6H21" />
        </svg>
      );
    case 'shopping':
      return (
        <svg {...common}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    default: // hub
      return (
        <svg {...common}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
  }
}

// Kleine Zusatzsymbole für Anlege-Menüs und Touren.
// name: camera | book | leaf | clipcheck | repeat | upload | plus | check
export function UiIcon({ name, size = 22, strokeWidth = 1.9 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...stroke, strokeWidth, 'aria-hidden': true };
  switch (name) {
    case 'camera':
      return <svg {...common}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>;
    case 'book':
      return <svg {...common}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>;
    case 'leaf':
      return <svg {...common}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" /><path d="M5 19l7-7" /></svg>;
    case 'clipcheck':
      return <svg {...common}><path d="M9 4h6v3H9z" /><path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1" /><path d="M9 14l2 2 4-4" /></svg>;
    case 'repeat':
      return <svg {...common}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>;
    case 'upload':
      return <svg {...common}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    default: // check
      return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  }
}
