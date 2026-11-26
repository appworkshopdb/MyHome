// Liste und Listenzeile: Symbol links, Titel und eine Nebenzeile, Wert oder Status rechts.
// Pfeil nur, wenn die Zeile zu einer Seite führt (chevron). Zeilenaktionen über "Mehr" (trailing).
import Icon from '../Icon.jsx';
import { StatusChip } from './Choice.jsx';

export function ListGroup({ children, className = '', ...rest }) {
  return <div className={`ui-list${className ? ` ${className}` : ''}`} {...rest}>{children}</div>;
}

// tone: Bereichsfamilie für das Symbol (fin | food | sport | hab | shop | n); ohne tone die des offenen Bereichs.
// status: { tone: 'pos'|'caut'|'crit'|'neutral', label } · note: Notiz-Hinweis hinter dem Titel
export function ListRow({
  icon, tone, leading, title, note = false, sub, value, status, chevron = false, trailing, onClick, className = '', ...rest
}) {
  const Tag = onClick ? 'button' : 'div';
  const end = value != null || status;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ui-row${onClick ? ' ui-row--btn' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      {...rest}
    >
      {leading}
      {icon && (
        <span className={`ui-row-lead${tone ? ` tone-${tone}` : ''}`} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="ui-row-mid">
        <span className="ui-row-title">
          <span>{title}</span>
          {note && <Icon name="note" size={16} label="Mit Notiz" />}
        </span>
        {sub && <span className="ui-row-sub">{sub}</span>}
      </span>
      {end && (
        <span className="ui-row-end">
          {value != null && <span className="ui-row-value">{value}</span>}
          {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
        </span>
      )}
      {trailing}
      {chevron && <Icon name="open" size={20} className="ui-row-chev" />}
    </Tag>
  );
}
