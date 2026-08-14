import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Baut das Monatsraster inkl. Leerfelder vor dem Monatsersten, damit die
// Spalten zu den Wochentagen passen (Montag als erste Spalte).
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Mo=0

  const cells = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

export default function WorkoutCalendar({ workouts, month, onMonthChange, selectedDate, onSelectDate }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const cells = buildGrid(year, monthIndex);
  const todayIso = iso(new Date());

  // Einheiten je Tag vorgruppieren — sonst würde jede Zelle die ganze
  // Liste durchsuchen.
  const byDate = new Map();
  for (const w of workouts) {
    if (!byDate.has(w.occurred_on)) byDate.set(w.occurred_on, []);
    byDate.get(w.occurred_on).push(w);
  }

  function shiftMonth(delta) {
    onMonthChange(new Date(year, monthIndex + delta, 1));
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
          <IconChevronLeft />
        </button>
        <div style={{ fontWeight: 600 }}>{MONTHS[monthIndex]} {year}</div>
        <button className="btn btn-secondary" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
          <IconChevronRight />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', paddingBottom: 4 }}>
            {d}
          </div>
        ))}

        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;

          const key = iso(date);
          const dayWorkouts = byDate.get(key) ?? [];
          const hasDone = dayWorkouts.some((w) => w.status === 'done');
          const hasPlanned = dayWorkouts.some((w) => w.status !== 'done');
          const isSelected = key === selectedDate;
          const isToday = key === todayIso;

          // Abgehakt = gefüllte Akzentfläche, geplant = nur Rahmen.
          // Auf --accent immer --on-accent als Textfarbe (Design-System).
          const background = isSelected
            ? 'var(--text-primary)'
            : hasDone ? 'var(--accent)' : 'transparent';
          const color = isSelected
            ? 'var(--bg-primary)'
            : hasDone ? 'var(--on-accent)' : 'var(--text-primary)';

          return (
            <button
              key={key}
              onClick={() => onSelectDate(key)}
              style={{
                aspectRatio: '1', border: hasPlanned && !hasDone ? '2px solid var(--accent)' : 'none',
                borderRadius: 'var(--radius-xs)', background, color,
                fontWeight: isToday ? 700 : 400, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', padding: 0,
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginRight: 4 }} />erledigt</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, border: '2px solid var(--accent)', marginRight: 4 }} />geplant</span>
      </div>
    </div>
  );
}
