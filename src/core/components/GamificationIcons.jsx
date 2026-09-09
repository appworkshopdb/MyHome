// core/components/GamificationIcons.jsx
// Platzhalter-Icons für Vogel (Streak) und Nest (Level).
// Stil: 1.8px Stroke, round caps/joins — identisch mit den anderen Icons
// in der App. Austauschbar durch echtes Artwork sobald vorhanden.

// Vogel-Icon (Streak) — einfache Silhouette als Strich-Icon
export function IconBird({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Körper */}
      <ellipse cx="12" cy="13" rx="5" ry="4" />
      {/* Kopf */}
      <circle cx="17" cy="9" r="2.5" />
      {/* Schnabel */}
      <path d="M19 9l2.5-0.5" />
      {/* Schwanzfedern */}
      <path d="M7 14l-2 2.5M7 15l-3 1.5" />
      {/* Flügel-Andeutung */}
      <path d="M10 11c0-2 3-3.5 5-2" />
      {/* Äuglein */}
      <circle cx="17.5" cy="8.5" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Nest-Icon (Level) — Mulde mit Zweigen
export function IconNest({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Nest-Mulde (Halbellipse) */}
      <path d="M4 15 Q12 20 20 15" />
      {/* Zweige links */}
      <path d="M4 15 Q5 12 7 13" />
      <path d="M6 13 Q7 10 10 12" />
      {/* Zweige rechts */}
      <path d="M20 15 Q19 12 17 13" />
      <path d="M18 13 Q17 10 14 12" />
      {/* Ei im Nest */}
      <ellipse cx="12" cy="13.5" rx="2.2" ry="1.6" />
    </svg>
  );
}
