import { CATEGORY_ORDER, computeBadges } from '../lib/badges';

// Zeigt jedes Badge als Chip — erreicht: gefüllte Akzentfläche mit
// --on-accent-Text (Design-System-Regel für Text auf --accent). Offen:
// nur Rahmen, mit "3/10"-Fortschritt statt stumpf ausgegraut — das
// motiviert stärker als ein reines Schloss-Symbol, weil sichtbar ist,
// wie nah man dran ist.
export default function BadgesCard({ workouts, stats }) {
  const badges = computeBadges(stats);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="card">
      <div className="card-title">Erfolge ({earnedCount}/{badges.length})</div>

      {CATEGORY_ORDER.map((category) => {
        const items = badges.filter((b) => b.category === category);
        return (
          <div key={category} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>{category}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((b) => (
                <div
                  key={b.key}
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${b.earned ? 'var(--accent)' : 'var(--border)'}`,
                    background: b.earned ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: b.earned ? 'var(--on-accent)' : 'var(--text-secondary)',
                    fontSize: '0.78rem', fontWeight: 600,
                  }}
                >
                  {b.label}
                  {!b.earned && (
                    <span style={{ fontWeight: 400, opacity: 0.75 }}> · {b.value}/{b.target}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
