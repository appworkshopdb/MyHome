// core/components/EnvelopeArt.jsx
// Briefumschlag mit Herz für die „Fast geschafft“-Seite (E-Mail bestätigen).
export default function EnvelopeArt({ height = 180 }) {
  return (
    <svg viewBox="0 0 240 190" style={{ height, width: 'auto' }} aria-hidden="true">
      <ellipse cx="120" cy="172" rx="86" ry="9" fill="#1B2A4A" opacity=".10" />
      <g transform="rotate(-6 120 100)">
        <rect x="34" y="60" width="172" height="106" rx="16" fill="#FFFFFF" stroke="#1B2A4A" strokeWidth="3" />
        <path d="M38 70 L120 124 L202 70" fill="none" stroke="#1B2A4A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M38 158 L98 108 M202 158 L142 108" fill="none" stroke="#97A6C2" strokeWidth="2.5" strokeLinecap="round" />
        <g transform="translate(0 -4)">
          <path d="M120 40 C112 24 88 30 92 48 C95 62 120 76 120 76 C120 76 145 62 148 48 C152 30 128 24 120 40 Z" fill="#E5762F" />
          <path d="M110 52 l7 7 l13 -15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <circle cx="26" cy="46" r="5" fill="#E5762F" />
      <circle cx="214" cy="38" r="4" fill="#4C6493" />
      <circle cx="204" cy="150" r="3.5" fill="#E5762F" opacity=".7" />
      <path d="M40 24 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#97A6C2" />
    </svg>
  );
}
