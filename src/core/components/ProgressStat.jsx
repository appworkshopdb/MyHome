// Generischer "X von Y"-Fortschritt: große Zahl + dünner Balken +
// Label. Rein präsentational, holt sich keine Daten selbst — jedes
// Modul (oder core selbst, siehe Hub.jsx) berechnet value/target auf
// seine eigene Art und übergibt nur Zahlen. Zwei Varianten:
//   'bar'  — kompakt, für Listen/Zeilen (z.B. in GoalsSection)
//   'card' — größere Kachel mit eigenem Rahmen, antippbar (z.B. Hub)
export default function ProgressStat({
  value,
  target,
  label,
  sublabel,
  variant = 'bar',
  onClick,
  celebrate = false,
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const Tag = onClick ? 'button' : 'div';

  if (variant === 'card') {
    return (
      <Tag
        className={`progress-stat-card ${celebrate ? 'progress-stat-card--done' : ''}`}
        onClick={onClick}
      >
        <div className="progress-stat-card-top">
          <div className="progress-stat-card-label">{label}</div>
          <div className="progress-stat-card-score">
            <span className="progress-stat-card-value">{value}</span>
            <span className="progress-stat-card-sep">/</span>
            <span className="progress-stat-card-target">{target}</span>
          </div>
        </div>
        <div className="progress-stat-bar">
          <div className="progress-stat-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {sublabel && <div className="progress-stat-card-sub">{sublabel}</div>}
      </Tag>
    );
  }

  return (
    <div className="progress-stat-inline">
      <div className="progress-stat-inline-top">
        <span>{label}</span>
        <span className="progress-stat-inline-count">{value} / {target}</span>
      </div>
      <div className="progress-stat-bar progress-stat-bar--sm">
        <div className="progress-stat-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
