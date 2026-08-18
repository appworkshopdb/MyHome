import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// Ein gemeinsamer Kopf für Monats- und Wochenansicht: Umschalter oben,
// darunter Vor/Zurück um den jeweiligen Zeitraum plus eine direkte
// Jahresauswahl — sonst müsste man sich für ein Datum in einem anderen
// Jahr durch viele Monate/Wochen vorklicken.
export default function CalendarHeader({ viewMode, onViewModeChange, referenceDate, onReferenceChange }) {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();

  function shift(delta) {
    const next = new Date(referenceDate);
    if (viewMode === 'month') {
      next.setDate(1); // verhindert Monatssprung durch Tageszahl > Zieltage
      next.setMonth(next.getMonth() + delta);
    } else {
      next.setDate(next.getDate() + delta * 7);
    }
    onReferenceChange(next);
  }

  function changeYear(newYear) {
    const next = new Date(referenceDate);
    next.setFullYear(newYear);
    onReferenceChange(next);
  }

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 1; y++) yearOptions.push(y);

  return (
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
        {[['month', 'Monat'], ['week', 'Woche']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => onViewModeChange(key)}
            style={{
              padding: '8px 4px', borderRadius: 'var(--radius-xs)',
              border: `1.5px solid ${viewMode === key ? 'var(--accent)' : 'var(--border)'}`,
              background: viewMode === key ? 'var(--accent)' : 'var(--bg-secondary)',
              color: viewMode === key ? 'var(--on-accent)' : 'var(--text-secondary)',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => shift(-1)} aria-label="Zurück">
          <IconChevronLeft />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {viewMode === 'month' && <span style={{ fontWeight: 600 }}>{MONTHS[monthIndex]}</span>}
          <select value={year} onChange={(e) => changeYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={() => shift(1)} aria-label="Vor">
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}
