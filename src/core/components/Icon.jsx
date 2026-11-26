// Ein Symbolset für die ganze App (Redesign, bestätigt am 26.11.2026 im Bausteine-Mockup).
// 24er-Raster, Strich 1,75, runde Enden, Farbe aus dem Text (currentColor). Ein Symbol, eine Bedeutung:
// "edit" nur fürs Ändern, "type" (Tastatur) für manuelles Eintippen, "trash" nur fürs Löschen.
// Neue Symbole kommen hierher, nicht als eigenes <svg> in eine Komponente (Regel-Check "design-symbol").
//
//   <Icon name="edit" />                  20 px, dekorativ (aria-hidden)
//   <Icon name="trash" size={18} />
//   <Icon name="info" label="Hinweis" />  mit Bedeutung für Screenreader
//   size={null}                           keine Größe am <svg>, das CSS bestimmt sie

const DOTS = 2.8; // Punkte (Mehr, Verschieben) brauchen einen dickeren Strich

const PATHS = {
  // Verwalten
  edit: 'M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17zM14.5 7.5l3 3',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 11v6M14 11v6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pause: 'M9 5v14M15 5v14',
  play: 'M8 5.5v13l10.5-6.5z',
  archive: 'M4.5 4.5h15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zM5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9M10 12.5h4',
  restore: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  // Navigation
  back: 'M15 5l-7 7 7 7',
  open: 'M9 5l7 7-7 7',
  expand: 'M5 9l7 7 7-7',
  collapse: 'M5 15l7-7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M4.5 11a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M20 20l-4.2-4.2',
  filter: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  sort: 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4',
  settings: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  // Erfassen
  plus: 'M12 5v14M5 12h14',
  minus: 'M6 12h12',
  type: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M7.5 14h9',
  scan: 'M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM8.8 13a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0',
  gallery: 'M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM7.4 10a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M20.5 16l-5-5-9 8.5',
  calendar: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
  note: 'M6 4h9l4 4v12H6zM14.5 4v4.5H19M9 13h6M9 16.5h4',
  split: 'M6 8.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3.5 19a5.5 5.5 0 0 1 11 0M14.7 9.5a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0M15.8 14.3A4.5 4.5 0 0 1 21 18.6',
  repeat: 'M4 9a8 8 0 0 1 14-3l2 2M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2M4 20v-4h4',
  file: 'M6 4h9l4 4v12H6zM14.5 4v4.5H19',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19l7-7',
  clipcheck: 'M9 4h6v3H9zM7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M9 14l2 2 4-4',
  // Status und Hinweise
  check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0M12 11v5M12 8h.01',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0',
  eyeOff: 'M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.3M6.5 7.4C4 9.1 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
  due: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0M12 7.5V12l3 2',
  streak: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.8-2.8 1.8-3.8.2 1.4.9 2.3 1.7 2.8C11.7 8.4 11.4 5.6 12 3z',
  rest: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  // Bereiche
  home: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5',
  habits: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0M8 12.2l2.8 2.8L16 9.6',
  euro: 'M17 7.5A6 6 0 1 0 17 16.5M5 10.5h8M5 13.5h8',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  food: 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M14 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
  cart: 'M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 19.5h.01M17 19.5h.01'
};

const THICK = { more: DOTS, drag: DOTS };

export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({ name, size = 20, strokeWidth, label, className, style }) {
  const d = PATHS[name];
  if (!d) return null;
  const dims = size == null ? {} : { width: size, height: size };
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? THICK[name] ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...dims}
      {...a11y}
    >
      <path d={d} />
    </svg>
  );
}
