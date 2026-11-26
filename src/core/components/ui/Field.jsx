// Formular-Bausteine: Beschriftung darüber, 16 px Text, Fehler direkt darunter.
// Kein "optional"; Pflicht erst zeigen, wenn es fehlt (error).
import { forwardRef, useId } from 'react';
import Icon from '../Icon.jsx';

export function Field({ label, error, htmlFor, children, className = '' }) {
  return (
    <div className={`ui-field${className ? ` ${className}` : ''}`}>
      {label && <label className="ui-field-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error && (
        <span className="ui-field-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </span>
      )}
    </div>
  );
}

// Text- oder Zahlfeld mit Beschriftung. multiline macht daraus ein Textfeld für Notizen.
export const TextField = forwardRef(function TextField({ label, error, id, multiline = false, className = '', ...rest }, ref) {
  const autoId = useId();
  const fid = id || autoId;
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Field label={label} error={error} htmlFor={fid} className={className}>
      <Tag ref={ref} id={fid} className="ui-input" aria-invalid={error ? 'true' : undefined} {...rest} />
    </Field>
  );
});

// Auswahl, die ein Fenster oder Menü öffnet (Zahlungsart, Datum …).
export function SelectButton({ label, value, placeholder, icon, onClick, error, className = '' }) {
  const autoId = useId();
  return (
    <Field label={label} error={error} htmlFor={autoId} className={className}>
      <button id={autoId} type="button" className="ui-select" onClick={onClick} aria-invalid={error ? 'true' : undefined}>
        {icon && <Icon name={icon} size={20} />}
        <span className={`ui-select-value${value ? '' : ' is-empty'}`}>{value || placeholder}</span>
        {!icon && <Icon name="expand" size={20} />}
      </button>
    </Field>
  );
}
