// Leer, Laden, Fehler: eigene Zustände, überall gleich.
import Icon from '../Icon.jsx';
import { Button } from './Button.jsx';

// Leerzustand: Symbol, eine Zeile, eine Aktion.
export function EmptyState({ icon = 'list', title, action, className = '' }) {
  return (
    <div className={`ui-empty${className ? ` ${className}` : ''}`}>
      <span className="ui-empty-icon" aria-hidden="true"><Icon name={icon} size={24} /></span>
      <span className="ui-empty-title">{title}</span>
      {action && <Button size="s" icon={action.icon || 'plus'} onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

// Fehlerzustand ohne Technikwörter.
export function ErrorState({ title = 'Keine Verbindung', onRetry, className = '' }) {
  return (
    <div className={`ui-error${className ? ` ${className}` : ''}`} role="alert">
      <span className="ui-error-icon" aria-hidden="true"><Icon name="offline" size={22} /></span>
      <span className="ui-error-title">{title}</span>
      {onRetry && <Button variant="secondary" size="s" icon="restore" onClick={onRetry}>Erneut versuchen</Button>}
    </div>
  );
}

// Ein schimmernder Platzhalter. w/h als CSS-Länge (z. B. "60%", 14).
export function Skeleton({ w = '100%', h = 14, round = false, className = '' }) {
  const size = { width: typeof w === 'number' ? `${w}px` : w, height: typeof h === 'number' ? `${h}px` : h };
  return <span className={`ui-sk${round ? ' ui-sk--round' : ''}${className ? ` ${className}` : ''}`} style={size} aria-hidden="true" />;
}

// Platzhalter für eine Liste in der Form echter Zeilen.
export function SkeletonList({ rows = 3 }) {
  return (
    <div className="ui-list ui-sk-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="ui-row" key={i}>
          <Skeleton w={40} h={40} round />
          <span className="ui-row-mid">
            <Skeleton w={`${60 - i * 8}%`} h={14} />
            <Skeleton w={`${34 + i * 4}%`} h={10} />
          </span>
          <Skeleton w={56} h={14} />
        </div>
      ))}
    </div>
  );
}

// Ladegerüst einer ganzen Seite (Fokuskarte, zwei Kacheln, Liste). Erscheint erst nach
// 300 ms und blendet weich ein, damit schnelles Laden nicht flackert.
export function PageSkeleton() {
  return (
    <div className="ui-page-sk" aria-busy="true" aria-label="Lädt">
      <Skeleton h={132} className="ui-sk--card" />
      <div className="ui-page-sk-tiles">
        <Skeleton h={88} className="ui-sk--card" />
        <Skeleton h={88} className="ui-sk--card" />
      </div>
      <SkeletonList rows={3} />
    </div>
  );
}
