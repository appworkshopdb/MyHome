import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

const MODES = [
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'year', label: 'Jahr' },
  { key: 'custom', label: 'Zeitraum' },
];

// Woche/Monat/Jahr blättern per Pfeil (offset, wie die Monats-
// Navigation im Kalender); "Vor" ist gesperrt, sobald man wieder bei
// der aktuellen Periode ist — in die Zukunft gibt es nichts auszuwerten.
// "Zeitraum" ersetzt die Pfeile durch zwei freie Datumsfelder.
export default function FilterBar({ mode, onModeChange, offset, onOffsetChange, label, customStart, customEnd, onCustomChange }) {
  return (
    <div className="sa-filter">
      <div className="sa-seg" role="group" aria-label="Zeitraum-Art">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={mode === m.key ? 'on' : ''}
            aria-pressed={mode === m.key}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'custom' ? (
        <div className="sa-card">
          <div className="form-row">
            <div className="form-group">
              <label>Von</label>
              <input type="date" value={customStart} onChange={(e) => onCustomChange(e.target.value, customEnd)} />
            </div>
            <div className="form-group">
              <label>Bis</label>
              <input type="date" value={customEnd} onChange={(e) => onCustomChange(customStart, e.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="sa-nav">
          <button className="sa-nav-b" onClick={() => onOffsetChange(offset - 1)} aria-label="Zurück">
            <IconChevronLeft />
          </button>
          <span>{label}</span>
          <button className="sa-nav-b" onClick={() => onOffsetChange(offset + 1)} disabled={offset >= 0} aria-label="Vor">
            <IconChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
