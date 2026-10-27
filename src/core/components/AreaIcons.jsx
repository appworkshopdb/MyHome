// core/components/AreaIcons.jsx
// Kleine Strichsymbole für die Bereichs-Kacheln (AreaRow, Hub-Kacheln).
// Gleiche Zeichenweise wie ModuleIcons.jsx (24er Raster, 1.8px, runde
// Enden, Farbe über currentColor). Die Modul-Symbole selbst kommen aus
// ModuleIcons — hier stehen nur die zusätzlichen Bereichs-Symbole.
import { ModuleIcon } from './ModuleIcons';

const MODULE_IDS = ['hub', 'habits', 'finance', 'sport', 'nutrition', 'shopping'];
const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function AreaIcon({ id, size = 15, strokeWidth = 1.9 }) {
  if (MODULE_IDS.includes(id)) return <ModuleIcon id={id} size={size} strokeWidth={strokeWidth} />;
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...stroke, strokeWidth, 'aria-hidden': true };
  switch (id) {
    case 'list': // Buchungen
      return (<svg {...common}><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>);
    case 'clock': // Offene Posten
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>);
    case 'contract': // Verträge
      return (<svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>);
    case 'chart': // Auswertung, Statistiken
      return (<svg {...common}><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="18" y1="20" x2="18" y2="14" /></svg>);
    case 'gear': // Einstellungen
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
    case 'ampel': // Ernährung: Ampel
      return (<svg {...common}><rect x="8" y="2.5" width="8" height="19" rx="4" /><circle cx="12" cy="7.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="16.5" r="1.2" /></svg>);
    case 'book': // Lexikon
      return (<svg {...common}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19v-14" /><line x1="9" y1="8" x2="15" y2="8" /></svg>);
    case 'bulb': // Tipps
      return (<svg {...common}><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>);
    case 'plan': // Pläne
      return (<svg {...common}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /></svg>);
    case 'scale': // Gewicht
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 9.5a4.2 4.2 0 0 1 7 0" /><line x1="12" y1="9.5" x2="13.6" y2="7.8" /></svg>);
    case 'calendar':
      return (<svg {...common}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="6.5" /><line x1="16" y1="3" x2="16" y2="6.5" /></svg>);
    case 'tasks':
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="4" /><polyline points="8.5 12.5 11 15 15.5 9.5" /></svg>);
    case 'pig': // Sparschwein (nur als Notnagel, die Finanzen nutzen ihr eigenes Bild)
      return (<svg {...common}><circle cx="12" cy="12" r="8" /><line x1="12" y1="8" x2="12" y2="16" /><path d="M14.5 9.5h-3.2a1.4 1.4 0 0 0 0 2.8h1.4a1.4 1.4 0 0 1 0 2.8H9.5" /></svg>);
    default:
      return null;
  }
}
