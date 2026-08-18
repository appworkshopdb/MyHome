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
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            style={{
              padding: '8px 4px', borderRadius: 'var(--radius-xs)',
              border: `1.5px solid ${mode === m.key ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === m.key ? 'var(--accent)' : 'var(--bg-secondary)',
              color: mode === m.key ? 'var(--on-accent)' : 'var(--text-secondary)',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'custom' ? (
        <div className="form-row" style={{ marginTop: 10 }}>
          <div className="form-group">
            <label>Von</label>
            <input type="date" value={customStart} onChange={(e) => onCustomChange(e.target.value, customEnd)} />
          </div>
          <div className="form-group">
            <label>Bis</label>
            <input type="date" value={customEnd} onChange={(e) => onCustomChange(customStart, e.target.value)} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={() => onOffsetChange(offset - 1)} aria-label="Zurück">
            <IconChevronLeft />
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
          <button className="btn btn-secondary" onClick={() => onOffsetChange(offset + 1)} disabled={offset >= 0} aria-label="Vor">
            <IconChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
