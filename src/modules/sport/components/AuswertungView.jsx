import { useState } from 'react';
import { computeStats } from '../lib/stats';
import SportIcon from './SportIcons';
import { weekRange, monthRange, yearRange, customRange, filterWorkoutsByRange } from '../lib/dateRange';
import BadgesCard from './BadgesCard';
import ActivityHeatmap from './ActivityHeatmap';
import FilterBar from './FilterBar';
import WeightTimeline from './WeightTimeline';

function Tile({ icon, value, label, wide }) {
  return (
    <div className={`sa-tile${wide ? ' wide' : ''}`}>
      <span className="sa-tile-ic"><SportIcon name={icon} size={18} /></span>
      <div><b>{value}</b><span>{label}</span></div>
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
    return <div className="page"><div className="sa-card">Lädt…</div></div>;
  }

  const statsAll = computeStats(workouts);

  if (statsAll.allCount === 0 && statsAll.restCount === 0) {
    return (
      <div className="page">
        <WeightTimeline />
        <div className="sa-card">
          <div className="sa-ch">Auswertung</div>
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
      <WeightTimeline />

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
        <div className="sa-card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Das Bis-Datum liegt vor dem Von-Datum. Bitte Zeitraum prüfen.
          </p>
        </div>
      ) : statsFiltered.allCount === 0 && statsFiltered.restCount === 0 ? (
        <div className="sa-card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Keine Einheit in diesem Zeitraum.
          </p>
        </div>
      ) : (
        <>
          <div className="sa-card">
            <div className="sa-ch">{range.label}</div>
            <div className="sa-tiles">
              <Tile icon="list" value={statsFiltered.allCount} label="Einheiten gesamt" />
              <Tile icon="check" value={statsFiltered.totalCount} label="Erledigt" />
              <Tile icon="clock" value={statsFiltered.openCount} label="Offen" />
              <Tile icon="moon" value={statsFiltered.restCount} label="Restdays" />
            </div>
          </div>

          <BadgesCard workouts={filteredWorkouts} stats={statsFiltered} />

          <div className="sa-card">
            <div className="sa-ch">Verteilung nach Typ</div>
            {statsFiltered.typeDistribution.map(({ label, count }) => (
              <div key={label} className="sa-dist">
                <div className="sa-dist-row"><span>{label}</span><span>{count}×</span></div>
                <div className="sa-bar"><i style={{ width: `${(count / maxCount) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sa-card">
        <div className="sa-ch">Insgesamt</div>
        <div className="sa-tiles">
          <Tile icon="list" value={statsAll.allCount} label="Einheiten gesamt" />
          <Tile icon="check" value={statsAll.totalCount} label="Erledigt" />
          <Tile icon="clock" value={statsAll.openCount} label="Offen" />
          <Tile icon="moon" value={statsAll.restCount} label="Restdays" />
          <Tile icon="flame" value={statsAll.streakWeeks} label="Wochen-Serie" wide />
        </div>
      </div>
    </div>
  );
}
