// core/components/Ring.jsx
// Kleiner Fortschrittsring (SVG, Farbe über currentColor/--ring-ac).
// value: 0–1 (wird begrenzt). children: Beschriftung in der Mitte.
// Rein darstellend — die Rechnung (x von y) bleibt beim Aufrufer.
export default function Ring({ size = 52, stroke = 6, value = 0, children, className = '' }) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <span className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-arc" cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        />
      </svg>
      {children != null && <span className="ring-label">{children}</span>}
    </span>
  );
}
