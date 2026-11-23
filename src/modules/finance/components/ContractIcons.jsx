// Symbole für laufende Einträge (Seite "Verträge"): Einnahme, Fixkosten, Vertrag.
// Nur Gestaltung; Größe setzt das CSS (.vt-ic svg, .rf-type svg).

const props = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

// Münze mit Euro-Zeichen
export const IconIncome = () => (
  <svg {...props} strokeWidth={1.7}><circle cx="12" cy="12" r="10" /><path d="M16 8.3a5 5 0 100 7.4M7.5 10.6h7M7.5 13.4h7" /></svg>
);

// Kalender (feste, wiederkehrende Termine)
export const IconFixed = () => (
  <svg {...props}>
    <path d="M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM3 10h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
  </svg>
);

// Vertrag: Blatt mit Eselsohr und Zeilen
export const IconContract = () => (
  <svg {...props}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4" /></svg>
);

export const IconPlus = () => (
  <svg {...props} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconChevron = ({ open }) => (
  <svg {...props} strokeWidth={2.4}><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
);
