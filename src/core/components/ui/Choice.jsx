// Auswahl-Bausteine: Umschalter, Filter-Chip, Status-Chip, Abhaken, Schalter.
import Icon from '../Icon.jsx';

// Umschalter mit gleitender Markierung.
// options: [{ value, label, status? }]; status "pos" | "caut" färbt nach Bedeutung (Offen/Bezahlt).
export function Segmented({ options, value, onChange, label, className = '' }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const status = options[i]?.status;
  const pos = { '--n': options.length, '--i': i };
  return (
    <div className={`ui-seg${status ? ` ui-seg--${status}` : ''}${className ? ` ${className}` : ''}`} role="group" aria-label={label} style={pos}>
      <span className="ui-seg-thumb" aria-hidden="true" />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => onChange(o.value)}>
            {on && o.status === 'pos' && <Icon name="check" size={16} strokeWidth={2.4} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Filter-Chip: dünne Kante, ausgewählt getönt mit Haken.
export function FilterChip({ selected = false, count, onClick, children, className = '' }) {
  return (
    <button type="button" className={`ui-chip${selected ? ' is-on' : ''}${className ? ` ${className}` : ''}`} aria-pressed={selected} onClick={onClick}>
      {selected && <Icon name="check" size={16} strokeWidth={2.2} />}
      {children}
      {count != null && <span className="ui-chip-count">{count}</span>}
    </button>
  );
}

// Status-Chip: Farbe nach Bedeutung, immer mit Wort. tone: pos | caut | crit | neutral
export function StatusChip({ tone = 'neutral', children }) {
  return <span className={`ui-status ui-status--${tone}`}>{children}</span>;
}

// Abhaken: Kästchen füllt sich, Haken zeichnet sich, Text wird durchgestrichen.
export function Checkbox({ checked, onChange, children, sub, className = '' }) {
  return (
    <button type="button" className={`ui-check${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`} role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="ui-check-box" aria-hidden="true">
        <Icon name="check" size={18} strokeWidth={2.6} />
      </span>
      <span className="ui-check-text">
        <span className="ui-check-label">{children}</span>
        {sub && <span className="ui-check-sub">{sub}</span>}
      </span>
    </button>
  );
}

// Schalter (an/aus) mit Beschriftung links.
export function Switch({ checked, onChange, children, className = '' }) {
  return (
    <button type="button" className={`ui-switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="ui-switch-label">{children}</span>
      <span className="ui-switch-track" aria-hidden="true" />
    </button>
  );
}
