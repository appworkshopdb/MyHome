// src/modules/sport/components/WorkoutCalendar.jsx
// Schritt 3-Fix: Symbol oben rechts in jeder Zelle.
// Offen = kleine Uhr (rund), Erledigt = kleiner Häkchen-Kreis (rund).
import { computeCellStyle, getCellBadge } from '../lib/dayVisualState';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

// Kleines rundes Symbol oben rechts in der Zelle
function CellBadge({ type }) {
  if (!type) return null;

  const baseStyle = {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--action-primary)',
  };

  if (type === 'done') {
    // Häkchen-Kreis — Erledigt
    return (
      <span style={baseStyle} aria-label="Erledigt">
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
          stroke="var(--text-on-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 5 4 7.5 8 3" />
        </svg>
      </span>
    );
  }

  // Uhr — Offen/Geplant
  return (
    <span style={baseStyle} aria-label="Geplant">
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
        stroke="var(--text-on-accent)" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="5" cy="5" r="4" />
        <polyline points="5 3 5 5 6.5 6" />
      </svg>
    </span>
  );
}

export default function WorkoutCalendar({ workouts, year, monthIndex, selectedDate, onSelectDate }) {
  const cells = buildGrid(year, monthIndex);
  const todayIso = iso(new Date());

  const byDate = new Map();
  for (const w of workouts) {
    if (!byDate.has(w.occurred_on)) byDate.set(w.occurred_on, []);
    byDate.get(w.occurred_on).push(w);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {WEEKDAYS.map((d) => (
        <div key={d} style={{
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          paddingBottom: 4,
        }}>
          {d}
        </div>
      ))}

      {cells.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} />;

        const key = iso(date);
        const dayWorkouts = byDate.get(key) ?? [];
        const style = computeCellStyle({
          dayWorkouts,
          isSelected: key === selectedDate,
          isToday: key === todayIso,
        });
        const badge = getCellBadge({ dayWorkouts });

        return (
          <button
            key={key}
            onClick={() => onSelectDate(key)}
            style={{
              aspectRatio: '1',
              borderRadius: 'var(--r-md)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              padding: 0,
              ...style,
            }}
            aria-label={`${date.getDate()}. ${badge === 'done' ? 'erledigt' : badge === 'planned' ? 'geplant' : ''}`}
          >
            {date.getDate()}
            <CellBadge type={badge} />
          </button>
        );
      })}
    </div>
  );
}
