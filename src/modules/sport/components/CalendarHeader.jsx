// src/modules/sport/components/CalendarHeader.jsx
// Schritt 3-Fix: Reihenfolge nach UX-Feedback umgebaut.
// 1. Monats-/Jahresnavigation oben (gleiche Optik wie Finanzen fin-month-nav)
// 2. Darunter: Monat/Woche Ansichtsumschalter als ModuleTabs
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export default function CalendarHeader({ viewMode, onViewModeChange, referenceDate, onReferenceChange }) {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();

  function shift(delta) {
    const next = new Date(referenceDate);
    if (viewMode === 'month') {
      next.setDate(1);
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
    <>
      {/* 1. Monats-/Jahresnavigation — gleiche Optik wie Finanzen */}
      <div className="fin-month-nav">
        <button
          className="month-nav-btn"
          onClick={() => shift(-1)}
          aria-label="Zurück"
        >
          <IconChevronLeft />
        </button>

        <span className="fin-month-label">
          {viewMode === 'month' && `${MONTHS[monthIndex]} `}
          <select
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="spo-year-select"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </span>

        <button
          className="month-nav-btn"
          onClick={() => shift(1)}
          aria-label="Vor"
        >
          <IconChevronRight />
        </button>
      </div>

      {/* 2. Ansichtsumschalter Monat / Woche */}
      <div className="module-tabs" style={{ marginTop: 8 }}>
        {[['month', 'Monat'], ['week', 'Woche']].map(([key, label]) => (
          <button
            key={key}
            className={`module-tab${viewMode === key ? ' active' : ''}`}
            onClick={() => onViewModeChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
