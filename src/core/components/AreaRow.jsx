// core/components/AreaRow.jsx
// Eine Zeile in der "Bereiche"-Liste: Label links, Kennzahl rechts (Ton
// steuert die Farbe), Chevron. Führt auf einen Detail-Screen (onPress).
//
// tone: 'neutral' (Standard, --text-muted) | 'caution' (--status-caution,
// z. B. "läuft aus") | 'critical' (--status-critical, z. B. "überfällig")
export default function AreaRow({ label, value, tone = 'neutral', onPress }) {
  return (
    <button className="area-row" onClick={onPress}>
      <span className="area-row-label">{label}</span>
      {value != null && (
        <span className={`area-row-value area-row-value--${tone}`}>{value}</span>
      )}
      <span className="area-row-chevron" aria-hidden="true">›</span>
    </button>
  );
}
