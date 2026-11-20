// Linien-Symbole für Einheiten (Schlüssel und Namen: lib/sportSymbols.js).
// Farbe über currentColor, damit Hell/Dunkel und Modulfarbe greifen.
const PATHS = {
  kraft: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  laufen: <><circle cx="14.5" cy="4.5" r="2" /><path d="M7 21l3.5-6.5 3 2.5v4.5M5.5 11.5 9 8l4.5 1 2.5 3.5H19M10.5 14.5 13 9" /></>,
  rad: <><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9.5 9h6l3 7.5M9.5 9l2.5 7.5h-6.5M14 6h3" /></>,
  schwimmen: <><circle cx="16" cy="6" r="2" /><path d="M5 13l4.5-4 3 2.5 3.5-2M3 17.5c2 0 2-1.5 4.5-1.5s2.5 1.5 4.5 1.5 2.5-1.5 4.5-1.5 2.5 1.5 4.5 1.5M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21" /></>,
  hiit: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />,
  kampf: <><path d="M7.5 12V7.5A4.5 4.5 0 0 1 12 3h2a4.5 4.5 0 0 1 4.5 4.5V12a5 5 0 0 1-5 5H9.5a2 2 0 0 1-2-2" /><path d="M7.5 13.5H6a2.2 2.2 0 0 1 0-4.4h1.5M8.5 21h8v-4h-8z" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5l4 2.9-1.5 4.6h-5L8 10.4zM12 3v4.5M21 10.4h-5M3 10.4h5M14.5 15l3 4M9.5 15l-3 4" /></>,
  schlaeger: <><circle cx="9.5" cy="9.5" r="6" /><path d="M5.5 9.5h8M9.5 5.5v8M13.8 13.8 20 20" /><circle cx="19" cy="5" r="1.5" /></>,
  mobility: <><circle cx="12" cy="4.5" r="2" /><path d="M12 7.5v6m0 0-3.5 7m3.5-7 3.5 7M4.5 10.5 12 8l7.5 2.5" /></>,
  wandern: <><path d="M3 20 9.5 9l4 6.5 2-3L21 20z" /><path d="M8 11.5l1.5 1.5 1.5-1.5" /></>,
  klettern: <><path d="M10 3.5h4a4.5 4.5 0 0 1 4.5 4.5v8a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 5.5 16V8A4.5 4.5 0 0 1 10 3.5z" /><path d="M5.5 11h5V7.5" /></>,
  tanzen: <><path d="M9 18V5.5L20 3v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  winter: <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2" />,
  wasser: <><path d="M3 15.5h18l-3 4.5H6z" /><path d="M12 15.5V3.5l6.5 9H12" /></>,
  gehen: <path d="M8.5 14.5c-1.6 0-2.7-1.6-2.7-4.2S7 4.5 8.5 4.5s2.6 2 2.6 4.6-1 5.4-2.6 5.4zM15.5 20c-1.6 0-2.6-1.6-2.6-4.2s1-6.3 2.6-6.3 2.7 2 2.7 4.6-1.1 5.9-2.7 5.9zM7 17.5h3M14 22h3" />,
  stern: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />,
};

export default function SportSymbol({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.stern}
    </svg>
  );
}
