// Kleine gemeinsame Bausteine der Auswertung (Icons, Zahlenformat, Delta-Anzeige).

const NF0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const eur0 = (v) => NF0.format(Math.round(v || 0));
export const pct1 = (v) => `${NF1.format(v * 100)} %`;
export const pct0 = (v) => `${Math.round(v * 100)} %`;

function Svg({ children, size = 18, stroke = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconChevronDown = () => <Svg><path d="M6 9l6 6 6-6" /></Svg>;
export const IconUp = () => <Svg stroke={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;
export const IconDown = () => <Svg stroke={2.4}><path d="M12 5v14M5 12l7 7 7-7" /></Svg>;
export const IconFilter = () => (
  <Svg size={20}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Svg>
);
export const IconRows = () => (
  <Svg size={20}><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /></Svg>
);
export const IconEye = () => (
  <Svg size={20}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const IconEyeOff = () => (
  <Svg size={20}><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2" /></Svg>
);
export const IconDownload = () => <Svg><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Svg>;
export const IconGrip = () => (
  <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="4" r="1.7" /><circle cx="11" cy="4" r="1.7" />
    <circle cx="5" cy="10" r="1.7" /><circle cx="11" cy="10" r="1.7" />
    <circle cx="5" cy="16" r="1.7" /><circle cx="11" cy="16" r="1.7" />
  </svg>
);

// Veränderung gegenüber dem Vergleichszeitraum. goodWhen: 'up' | 'down'
// (steigt der Wert = gut oder schlecht?). Immer Pfeil + Text, nie nur Farbe.
export function Delta({ value, base, goodWhen, unit = 'pct', label }) {
  if (base === null || base === undefined || value === null || value === undefined) return null;
  let diff; let text;
  if (unit === 'pp') {
    diff = (value - base) * 100;
    text = `${Math.abs(diff).toFixed(1).replace('.', ',')} PP`;
  } else {
    if (base === 0) return null;
    diff = (value / base - 1) * 100;
    text = `${Math.abs(diff).toFixed(1).replace('.', ',')} %`;
  }
  if (Math.abs(diff) < 0.05) return <span className="rp-delta rp-delta--flat">≈ gleich {label}</span>;
  const up = diff > 0;
  const good = (goodWhen === 'up') === up;
  return (
    <span className={`rp-delta ${good ? 'rp-delta--good' : 'rp-delta--bad'}`}>
      {up ? '▲' : '▼'} {text} {label}
    </span>
  );
}
