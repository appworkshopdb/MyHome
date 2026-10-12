import SheetShell from './SheetShell';

// Filter-Sheet des Kalenders: Quelle, Nestua-Kategorien, Google-Kalender und
// „Erledigte Aufgaben“. Änderungen wirken sofort auf die Liste dahinter, der
// Button zeigt die Trefferzahl und schließt das Sheet.
export default function CalendarFilterSheet({
  filter, categories, counts, shownCount, onChange, onToggleKey, onReset, onClose,
}) {
  const appCats = categories.filter((c) => !c.isGoogle);
  const googleCats = categories.filter((c) => c.isGoogle);

  function chip(c) {
    const off = filter.hidden.includes(c.key);
    const disabled = (filter.source === 'app' && c.isGoogle) || (filter.source === 'google' && !c.isGoogle);
    return (
      <button
        key={c.key}
        type="button"
        className={`calview-chip ${off ? 'off' : ''} ${disabled ? 'disabled' : ''}`}
        aria-pressed={!off}
        disabled={disabled}
        onClick={() => onToggleKey(c.key)}
      >
        <span className={`calview-dot ${c.isGoogle ? 'calview-dot--google' : ''}`} style={{ '--dot-color': c.color }} />
        {c.label}
        <span className="calview-chip-count">{counts[c.key] ?? 0}</span>
      </button>
    );
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">Filter</span>
        <button className="sheet-cancel" onClick={onReset}>Zurücksetzen</button>
      </div>
      <div className="calview-fsheet">
        <section>
          <div className="calview-fsheet-label">Quelle</div>
          <div className="calview-source-toggle" role="group" aria-label="Quelle">
            {[['alle', 'Alle'], ['app', 'Nur Nestua'], ['google', 'Nur Google']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter.source === key ? 'active' : ''}
                onClick={() => onChange({ source: key })}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="calview-fsheet-label">Nestua-Kategorien</div>
          <div className="calview-fsheet-wrap">{appCats.map(chip)}</div>
        </section>

        {googleCats.length > 0 && (
          <section>
            <div className="calview-fsheet-label">Google-Kalender</div>
            <div className="calview-fsheet-wrap">{googleCats.map(chip)}</div>
          </section>
        )}

        <div className="calview-fsheet-switch">
          <span>Erledigte Aufgaben anzeigen</span>
          <button
            type="button"
            className={`calview-switch ${filter.hideDone ? '' : 'on'}`}
            role="switch"
            aria-checked={!filter.hideDone}
            aria-label="Erledigte Aufgaben anzeigen"
            onClick={() => onChange({ hideDone: !filter.hideDone })}
          />
        </div>

        <button type="button" className="calview-apply" onClick={onClose}>
          {shownCount === 1 ? '1 Termin anzeigen' : `${shownCount} Termine anzeigen`}
        </button>
      </div>
    </SheetShell>
  );
}
