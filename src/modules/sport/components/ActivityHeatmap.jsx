import { useEffect, useMemo, useState } from 'react';
import { computeWeeklyActivity, formatWeekRange } from '../lib/stats';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Transparenzstufen des tatsächlichen Akzents (--accent, Elektroblau
// laut Design-System) statt mehrerer Farbtöne — passt zur Design-Regel
// "ein Akzent pro Ansicht, sonst nichts Buntes". color-mix() leitet die
// Transparenz direkt aus der CSS-Variable ab, dadurch automatisch
// korrekt in Hell- und Dunkelmodus, ohne einen Hex-Wert zu verdoppeln.
//
// BUGFIX: hier stand zuvor eine hartcodierte Limette (rgba(214,255,61,…))
// aus dem alten, längst abgelösten Lime-Design — sichtbar z.B. in der
// Legende "Weniger…Mehr", die dadurch gelb-grün statt blau wirkte.

// Eine Zeile pro Monat statt eines starren Rasters — ein Monat hat nie
// exakt 4 Wochen, eine Zeile pro Monat macht den Monatsdurchschnitt
// trotzdem auf einen Blick lesbar (anstelle eines Rechtecks, bei dem
// Monatsgrenzen mitten durch eine Spalte laufen).
function groupByMonth(weeks) {
  const rows = [];
  let current = null;
  for (const week of weeks) {
    const m = week.weekStart.getMonth();
    const y = week.weekStart.getFullYear();
    if (!current || current.month !== m || current.year !== y) {
      current = { month: m, year: y, weeks: [] };
      rows.push(current);
    }
    current.weeks.push(week);
  }
  return rows;
}

export default function ActivityHeatmap({ workouts, year }) {
  const weeks = useMemo(() => computeWeeklyActivity(workouts, year), [workouts, year]);
  const rows = useMemo(() => groupByMonth(weeks), [weeks]);
  // Ausgewählte Zelle zurücksetzen, wenn sich das Jahr ändert — sonst
  // zeigt die Detailkarte nach einem Jahreswechsel kurz einen Index,
  // der im neuen Jahr etwas ganz anderes bedeutet.
  const [selectedIndex, setSelectedIndex] = useState(weeks.length - 1);
  useEffect(() => { setSelectedIndex(weeks.length - 1); }, [year]);

  const selected = weeks[selectedIndex];
  const prev = weeks[selectedIndex - 1];
  const next = selectedIndex + 1 < weeks.length ? weeks[selectedIndex + 1] : null;

  return (
    <div className="sa-card">
      <div className="sa-ch">Aktivität {year}</div>

      <div className="sa-heat">
        {rows.map((row) => (
          <div key={`${row.year}-${row.month}`} className="sa-heat-row">
            <em>{MONTHS[row.month]}</em>
            {row.weeks.map((week) => {
              const globalIndex = weeks.indexOf(week);
              return (
                <button
                  key={week.weekStart.getTime()}
                  className={`sa-hc${globalIndex === selectedIndex ? ' sel' : ''}`}
                  data-l={week.level}
                  onClick={() => setSelectedIndex(globalIndex)}
                  aria-label={`Woche ${formatWeekRange(week.weekStart)}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="sa-heat-legend">
        <span>Weniger</span>
        {[0, 1, 2, 3].map((l) => <span key={l} className="sa-hc" data-l={l} />)}
        <span>Mehr</span>
      </div>

      {selected && (
        <div className="sa-heat-sum">
          <b>{formatWeekRange(selected.weekStart)}</b>
          <span>
            {selected.doneCount} erledigt{selected.plannedCount > 0 ? `, ${selected.plannedCount} geplant` : ''}
          </span>
          <span>{selected.types.length > 0 ? selected.types.join(', ') : 'Keine Einheit'}</span>
          <span className="sa-heat-diff">
            {prev && <span>Vorwoche: {formatDiff(selected.score - prev.score)}</span>}
            {next && <span>Folgewoche: {formatDiff(selected.score - next.score)}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function formatDiff(diff) {
  if (diff === 0) return 'gleich';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
