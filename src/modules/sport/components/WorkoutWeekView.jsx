import { computeCellStyle } from '../lib/dayVisualState';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Sieben Tage der gewählten Woche, größer als in der Monatsansicht —
// mehr Platz, weil nur eine statt fünf Zeilen. Teilt sich die
// Zell-Optik (computeCellStyle) mit WorkoutCalendar, damit beide
// Ansichten optisch konsistent bleiben.
export default function WorkoutWeekView({ workouts, weekStart, selectedDate, onSelectDate }) {
  const todayIso = iso(new Date());

  const byDate = new Map();
  for (const w of workouts) {
    if (!byDate.has(w.occurred_on)) byDate.set(w.occurred_on, []);
    byDate.get(w.occurred_on).push(w);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {days.map((date, i) => {
        const key = iso(date);
        const dayWorkouts = byDate.get(key) ?? [];
        const style = computeCellStyle({ dayWorkouts, isSelected: key === selectedDate, isToday: key === todayIso });

        return (
          <button
            key={key}
            onClick={() => onSelectDate(key)}
            style={{
              aspectRatio: '0.8', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              padding: 0, ...style,
            }}
          >
            <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>{WEEKDAYS[i]}</span>
            <span style={{ fontSize: '1rem' }}>{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
