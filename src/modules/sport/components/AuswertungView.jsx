import { useState } from 'react';
import { computeStats, formatDuration } from '../lib/stats';
import { weekRange, monthRange, yearRange, customRange, filterWorkoutsByRange } from '../lib/dateRange';
import BadgesCard from './BadgesCard';
import ActivityHeatmap from './ActivityHeatmap';
import FilterBar from './FilterBar';

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const WEEK_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

// Rechnet direkt aus den geladenen Einheiten (nur status='done'), nicht
// aus measurements — die Modul-eigene Auswertung darf ihre eigenen
// Daten lesen. measurements bleibt dem Hub vorbehalten, der
// modulübergreifend liest.
//
// Zwei getrennte Stats-Stände: statsFiltered (Zeitraum-abhängig, steuert
// auch die Erfolge) und statsAll (immer die ganze Historie, nur für den
// "Insgesamt"-Block am Ende). Die Heatmap bleibt bewusst unabhängig vom
// Filter — sie ist die 12-Monats-Übersicht mit eigener Wochen-Auswahl,
// kein von diesem Filter gesteuerter Ausschnitt.
export default function AuswertungView({ workouts, loading }) {
  const [mode, setMode] = useState('week');
  const [offset, setOffset] = useState(0);
  const [customStart, setCustomStart] = useState(WEEK_AGO);
  const [customEnd, setCustomEnd] = useState(TODAY);

  if (loading) {
    return <div className="page"><div className="card">Lädt…</div></div>;
  }

  const statsAll = computeStats(workouts);

  if (statsAll.totalCount === 0) {
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

  function handleModeChange(nextMode) {
    setMode(nextMode);
    setOffset(0); // sonst würde z.B. "vor 3 Monaten" beim Wechsel zu Jahr mitgenommen
  }

  const range = mode === 'week' ? weekRange(offset)
    : mode === 'month' ? monthRange(offset)
    : mode === 'year' ? yearRange(offset)
    : customRange(customStart, customEnd);

  const filteredWorkouts = filterWorkoutsByRange(workouts, range);
  const statsFiltered = computeStats(filteredWorkouts);
  const maxCount = statsFiltered.typeDistribution[0]?.count ?? 1;

  // Heatmap zeigt das Kalenderjahr, auf das der Filter gerade zeigt —
  // egal ob Woche/Monat/Jahr/Zeitraum, das Jahr des Bereichsanfangs
  // reicht als Orientierung. Ohne diese Kopplung würde die Heatmap z.B.
  // April 2025 nie zeigen können, während der Filter genau dort steht.
  const heatmapYear = range ? Number(range.startIso.slice(0, 4)) : new Date().getFullYear();

  return (
    <div className="page">
      <ActivityHeatmap workouts={workouts} year={heatmapYear} />

      <FilterBar
        mode={mode}
        onModeChange={handleModeChange}
        offset={offset}
        onOffsetChange={setOffset}
        label={range?.label ?? ''}
        customStart={customStart}
        customEnd={customEnd}
        onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
      />

      {!range ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Das Bis-Datum liegt vor dem Von-Datum. Bitte Zeitraum prüfen.
          </p>
        </div>
      ) : statsFiltered.totalCount === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Keine Einheit in diesem Zeitraum.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">{range.label}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Stat label="Einheiten" value={statsFiltered.totalCount} />
              <Stat label="Dauer" value={formatDuration(statsFiltered.totalDuration)} />
            </div>
          </div>

          <BadgesCard workouts={filteredWorkouts} stats={statsFiltered} />

          <div className="card">
            <div className="card-title">Verteilung nach Typ</div>
            {statsFiltered.typeDistribution.map(({ label, count }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>{label}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{count}×</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-input)' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-title">Insgesamt</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label="Einheiten" value={statsAll.totalCount} />
          <Stat label="Dauer" value={formatDuration(statsAll.totalDuration)} />
          <Stat label="Wochen-Serie" value={statsAll.streakWeeks} />
        </div>
      </div>
    </div>
  );
}
