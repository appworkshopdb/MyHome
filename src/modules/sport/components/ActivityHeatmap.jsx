import { useMemo, useState } from 'react';
import { computeWeeklyActivity, formatWeekRange } from '../lib/stats';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Transparenzstufen des einen Akzents statt mehrerer Farbtöne — passt
// zur Design-Regel "ein Akzent pro Ansicht, sonst nichts Buntes".
const LEVEL_COLORS = ['var(--border)', 'rgba(214,255,61,0.3)', 'rgba(214,255,61,0.6)', 'rgba(214,255,61,0.9)'];

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

export default function ActivityHeatmap({ workouts }) {
  const weeks = useMemo(() => computeWeeklyActivity(workouts), [workouts]);
  const rows = useMemo(() => groupByMonth(weeks), [weeks]);
  const [selectedIndex, setSelectedIndex] = useState(weeks.length - 1);

  const selected = weeks[selectedIndex];
  const prev = weeks[selectedIndex - 1];
  const next = selectedIndex + 1 < weeks.length ? weeks[selectedIndex + 1] : null;

  return (
    <div className="card">
      <div className="card-title">Aktivität</div>

      {rows.map((row) => (
        <div key={`${row.year}-${row.month}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <div style={{ width: 28, flexShrink: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {MONTHS[row.month]}
          </div>
          {row.weeks.map((week) => {
            const globalIndex = weeks.indexOf(week);
            const isSelected = globalIndex === selectedIndex;
            return (
              <button
                key={week.weekStart.getTime()}
                onClick={() => setSelectedIndex(globalIndex)}
                aria-label={`Woche ${formatWeekRange(week.weekStart)}`}
                style={{
                  width: 32, height: 32, flexShrink: 0, padding: 0, cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  background: LEVEL_COLORS[week.level],
                  border: isSelected ? '2px solid var(--text-primary)' : 'none',
                }}
              />
            );
          })}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 14px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        <span>Weniger</span>
        {LEVEL_COLORS.map((c, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
        ))}
        <span>Mehr</span>
      </div>

      {selected && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatWeekRange(selected.weekStart)}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            {selected.doneCount} erledigt{selected.plannedCount > 0 ? `, ${selected.plannedCount} geplant` : ''}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            {selected.types.length > 0 ? selected.types.join(', ') : 'Keine Einheit'}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {prev && <span>Vorwoche: {formatDiff(selected.score - prev.score)}</span>}
            {next && <span>Folgewoche: {formatDiff(selected.score - next.score)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDiff(diff) {
  if (diff === 0) return 'gleich';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
