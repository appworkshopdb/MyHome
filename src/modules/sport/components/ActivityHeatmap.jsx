import { useEffect, useMemo, useState } from 'react';
import { computeWeeklyActivity, formatWeekRange } from '../lib/stats';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Zwölf Spalten, je eine pro Monat; die Wochen stehen darunter (eine Zelle = eine Woche, nach
// dem Monat ihres Montags). Eine Woche, die noch im Vorjahr beginnt, steht in der Jan-Spalte,
// eine, die im Folgejahr beginnt, in der Dez-Spalte. So füllt das Raster die ganze Breite und
// ist nur 5 Zeilen hoch. Die Stufen (data-l 0–3) leiten sich in design-v2.css (.sa-hc) aus der
// Modulfarbe ab.
function groupByMonthColumns(weeks, year) {
  const cols = Array.from({ length: 12 }, () => []);
  weeks.forEach((week, index) => {
    const y = week.weekStart.getFullYear();
    const m = y < year ? 0 : y > year ? 11 : week.weekStart.getMonth();
    cols[m].push(index);
  });
  return cols;
}

// Vorauswahl: die aktuelle Woche, sonst (anderes Jahr) die letzte.
function defaultIndex(weeks, year) {
  if (year === new Date().getFullYear()) {
    const i = weeks.findIndex((w) => {
      const end = new Date(w.weekStart);
      end.setDate(end.getDate() + 7);
      return w.weekStart <= new Date() && new Date() < end;
    });
    if (i >= 0) return i;
  }
  return weeks.length - 1;
}

export default function ActivityHeatmap({ workouts, year }) {
  const weeks = useMemo(() => computeWeeklyActivity(workouts, year), [workouts, year]);
  const cols = useMemo(() => groupByMonthColumns(weeks, year), [weeks, year]);
  const rowCount = Math.max(...cols.map((c) => c.length));
  // Ausgewählte Zelle zurücksetzen, wenn sich das Jahr ändert — sonst
  // zeigt die Detailkarte nach einem Jahreswechsel kurz einen Index,
  // der im neuen Jahr etwas ganz anderes bedeutet.
  const [selectedIndex, setSelectedIndex] = useState(() => defaultIndex(weeks, year));
  useEffect(() => { setSelectedIndex(defaultIndex(weeks, year)); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = weeks[selectedIndex];
  const prev = weeks[selectedIndex - 1];
  const next = selectedIndex + 1 < weeks.length ? weeks[selectedIndex + 1] : null;

  return (
    <div className="sa-card">
      <div className="sa-heat-head">
        <div className="sa-ch">Aktivität {year}</div>
        <div className="sa-heat-legend">
          <span>Weniger</span>
          {[0, 1, 2, 3].map((l) => <span key={l} className="sa-hc" data-l={l} />)}
          <span>Mehr</span>
        </div>
      </div>

      <div className="sa-ga">
        {MONTHS.map((m) => <span key={m} className="sa-ml" title={m}>{m === 'Mär' ? 'M' : m[0]}</span>)}
        {Array.from({ length: rowCount }).flatMap((_, r) => cols.map((col, m) => {
          const index = col[r];
          if (index === undefined) return <span key={`${r}-${m}`} className="sa-hc sa-hc--empty" aria-hidden="true" />;
          const week = weeks[index];
          return (
            <button
              key={`${r}-${m}`}
              className={`sa-hc${index === selectedIndex ? ' sel' : ''}`}
              data-l={week.level}
              onClick={() => setSelectedIndex(index)}
              aria-label={`Woche ${formatWeekRange(week.weekStart)}`}
              aria-pressed={index === selectedIndex}
            />
          );
        }))}
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
