// core/components/ModuleIcons.jsx
// Die Bereichs-Symbole der Bottom-Nav (ModuleBottomNav.jsx) an EINER Stelle,
// damit Touren, Wizard und Nav dieselben Zeichnungen zeigen. Strichzeichnung,
// Farbe über currentColor.
//
// id: hub | habits | finance | sport | nutrition | shopping

import Icon from './Icon';

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

// Kleine Zusatzsymbole für Anlege-Menüs und Touren. Seit dem Redesign aus dem zentralen Symbolset (Icon.jsx).
// name: camera | book | leaf | clipcheck | repeat | upload | plus | check | eye | eyeoff | lock
const UI_TO_ICON = { camera: 'scan', book: 'book', leaf: 'leaf', clipcheck: 'clipcheck', repeat: 'repeat', upload: 'upload', plus: 'plus', check: 'check', eye: 'eye', eyeoff: 'eyeOff', lock: 'lock' };

export function UiIcon({ name, size = 22, strokeWidth }) {
  return <Icon name={UI_TO_ICON[name] || 'check'} size={size} strokeWidth={strokeWidth} />;
}
