import { computeStats, formatDuration } from '../lib/stats';

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

// Rechnet direkt aus den geladenen Einheiten (nur status='done'), nicht
// aus measurements — die Modul-eigene Auswertung darf ihre eigenen
// Daten lesen. measurements bleibt dem Hub vorbehalten, der
// modulübergreifend liest.
export default function AuswertungView({ workouts, loading }) {
  if (loading) {
    return <div className="page"><div className="card">Lädt…</div></div>;
  }

  const stats = computeStats(workouts);

  if (stats.totalCount === 0) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-title">Auswertung</div>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch keine abgeschlossene Einheit. Hake im Kalender ein Training ab,
            dann erscheinen hier deine Zahlen.
          </p>
        </div>
      </div>
    );
  }

  const maxCount = stats.typeDistribution[0]?.count ?? 1;

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">Diese Woche</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label="Einheiten" value={stats.weekCount} />
          <Stat label="Dauer" value={formatDuration(stats.weekDuration)} />
          <Stat label="Wochen-Serie" value={stats.streakWeeks} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Dieser Monat</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label="Einheiten" value={stats.monthCount} />
          <Stat label="Dauer" value={formatDuration(stats.monthDuration)} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Verteilung nach Typ</div>
        {stats.typeDistribution.map(({ label, count }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
              <span>{label}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{count}×</span>
            </div>
            {/* Balken relativ zum häufigsten Typ — zeigt Einseitigkeit
                auf einen Blick, ohne Achsen/Zahlen erklären zu müssen. */}
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-input)' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${(count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Insgesamt</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label="Einheiten" value={stats.totalCount} />
          <Stat label="Dauer" value={formatDuration(stats.totalDuration)} />
        </div>
      </div>
    </div>
  );
}
