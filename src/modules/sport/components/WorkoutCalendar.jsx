import { computeCellStyle } from '../lib/dayVisualState';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

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

// Nur noch das Raster selbst — Navigation (Monat/Woche-Umschalter,
// Vor/Zurück, Jahresauswahl) sitzt jetzt in CalendarHeader.jsx, die
// Legende in CalendarLegend.jsx. Beide Ansichten teilen sich dieselbe
// Kopf-/Fußzeile, nur das Raster dazwischen unterscheidet sich.
export default function WorkoutCalendar({ workouts, year, monthIndex, selectedDate, onSelectDate }) {
  const cells = buildGrid(year, monthIndex);
  const todayIso = iso(new Date());

  // Einheiten je Tag vorgruppieren — sonst würde jede Zelle die ganze
  // Liste durchsuchen.
  const byDate = new Map();
  for (const w of workouts) {
    if (!byDate.has(w.occurred_on)) byDate.set(w.occurred_on, []);
    byDate.get(w.occurred_on).push(w);
  }

  return (
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
        const style = computeCellStyle({ dayWorkouts, isSelected: key === selectedDate, isToday: key === todayIso });

        return (
          <button
            key={key}
            onClick={() => onSelectDate(key)}
            style={{
              aspectRatio: '1', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', padding: 0, ...style,
            }}
          >
            {date.getDate()}
          </button>
        );
      })}
    </div>
  );
}
