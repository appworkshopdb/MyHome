// Ruhetag-"Bild": Zzz (Schlaf) auf gestreiftem Grund, passend zu den gestreiften
// Ruhetag-Zellen im Kalender. Gezeichnet, keine Bilddatei. Farben über Tokens
// (siehe .pl-rest in design-v2.css), damit es auf hellem Grund und auf der
// Heute-Karte funktioniert.
export default function RestBadge({ size = 40 }) {
  return (
    <span className={`pl-rest${size <= 28 ? ' is-sm' : ''}`} style={{ width: size, height: size }} role="img" aria-label="Ruhetag">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h6l-6 8h6M12 5h5l-5 6h5M19 1.5h3l-3 3.5h3" />
      </svg>
    </span>
  );
}
