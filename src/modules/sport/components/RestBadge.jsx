// Ruhetag-"Bild": Mond auf gestreiftem Grund, passend zu den gestreiften
// Ruhetag-Zellen im Kalender. Gezeichnet, keine Bilddatei. Farben über Tokens
// (siehe .pl-rest in design-v2.css), damit es auf hellem Grund und auf der
// Heute-Karte funktioniert.
export default function RestBadge({ size = 40 }) {
  return (
    <span className="pl-rest" style={{ width: size, height: size }} role="img" aria-label="Ruhetag">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14a8 8 0 1 1-9-10 6 6 0 0 0 9 10z" />
      </svg>
    </span>
  );
}
