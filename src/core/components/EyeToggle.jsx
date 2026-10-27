// core/components/EyeToggle.jsx
// Auge zum Aus-/Einblenden von Beträgen (Saldo-Karte im Hub). Rein darstellend:
// der Zustand liegt in core/lib/privacyStore.js.
export default function EyeToggle({ hidden, onToggle }) {
  return (
    <button
      type="button"
      className="eye-toggle"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Beträge einblenden' : 'Beträge ausblenden'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}
