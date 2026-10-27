// core/components/GamificationIcons.jsx
// Vogelkopf-Maskottchen für die TopBar — Design von Claude Design (BirdHead.svg).
// Front-facing, runde Kappenform (braune Federn), cremefarbenes Gesicht,
// große Augen mit Glanzpunkt, warmer Orangeschnabel.
//
// Animationen (CSS-only, prefers-reduced-motion via base.css abgeschaltet):
//   bird-bob  — sanftes Wippen, 3 s Loop
//   bird-blink — beide Lider klappen leicht versetzt alle 5 s kurz zu

export function IconBird({ size = 28, animated = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={animated ? 'bird-head-anim' : undefined}
      style={{ overflow: 'visible', flexShrink: 0 }}
    >
      {/* Kappe / Rücken — braune Federsilhouette */}
      <circle cx="24" cy="24" r="16" fill="#5B4636" />

      {/* Gesichtsgruppe — 3° geneigt für neugierigen Blick */}
      <g transform="rotate(3 24 22)">
        {/* Cremefarbenes Gesicht */}
        <ellipse cx="24" cy="26.5" rx="12.5" ry="12" fill="#F3E4CE" />

        {/* Wangenrötung links / rechts */}
        <ellipse cx="14.2" cy="29" rx="3.2" ry="2.2" fill="#EFAE84" opacity="0.55" />
        <ellipse cx="33.8" cy="29" rx="3.2" ry="2.2" fill="#EFAE84" opacity="0.55" />

        {/* Auge links */}
        <circle cx="17.5" cy="24" r="4.3" fill="#2A2320" />
        <circle cx="16.3" cy="22.6" r="1.1" fill="#FFFFFF" opacity="0.9" />
        {/* Augenlid links (blinzelt) */}
        <ellipse
          cx="17.5" cy="24" rx="4.3" ry="4.3"
          fill="#F3E4CE"
          className="bird-lid bird-lid--l"
          style={{ transformOrigin: '17.5px 19.7px' }}
        />

        {/* Auge rechts */}
        <circle cx="30.5" cy="24" r="4.3" fill="#2A2320" />
        <circle cx="29.3" cy="22.6" r="1.1" fill="#FFFFFF" opacity="0.9" />
        {/* Augenlid rechts — leicht versetztes Delay via CSS */}
        <ellipse
          cx="30.5" cy="24" rx="4.3" ry="4.3"
          fill="#F3E4CE"
          className="bird-lid bird-lid--r"
          style={{ transformOrigin: '30.5px 19.7px' }}
        />

        {/* Schnabel */}
        <path
          d="M24,29 C21.5,29 20,30.5 20,32.5 C20,34.5 22,36 24,36 C26,36 28,34.5 28,32.5 C28,30.5 26.5,29 24,29 Z"
          fill="#E8905A"
        />
        <line
          x1="24" y1="30.2" x2="24" y2="34.8"
          stroke="#C97540" strokeWidth="0.6" opacity="0.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

// Nest-Icon (Level-Badge) — unverändert
export function IconNest({ size = 20 }) {
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
      <path d="M3.5 15 Q12 21.5 20.5 15" />
      <path d="M3.5 15 Q5 11.5 7.5 13" />
      <path d="M6 12.5 Q7.5 9.5 10.5 11.5" />
      <path d="M20.5 15 Q19 11.5 16.5 13" />
      <path d="M18 12.5 Q16.5 9.5 13.5 11.5" />
      <ellipse cx="12" cy="13" rx="2.5" ry="2"
        fill="currentColor" opacity="0.12"
        stroke="currentColor" strokeWidth="1.6"
      />
    </svg>
  );
}
