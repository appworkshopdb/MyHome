// Knöpfe des Redesigns. Ein Hauptknopf je Seite (variant="primary"), sonst
// "secondary" (Fläche mit Kante), "text" oder "danger". Größe M = 48 px, S = 36 px.
// loading zeigt einen Kreis im Knopf und sperrt ihn, bis die Aktion fertig ist.
import { forwardRef } from 'react';
import Icon from '../Icon.jsx';

export const Button = forwardRef(function Button({
  variant = 'primary', size = 'm', icon, iconRight, loading = false, block = false,
  className = '', type = 'button', disabled, children, ...rest
}, ref) {
  const iconSize = size === 's' ? 18 : 20;
  const cls = ['ui-btn', `ui-btn--${variant}`, size === 's' && 'ui-btn--s', block && 'ui-btn--block', loading && 'is-loading', className]
    .filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading
        ? <Icon name="spinner" size={iconSize} className="ui-ic-spin" />
        : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
});

// Knopf nur mit Symbol. label ist Pflicht (Screenreader und Tooltip).
// variant: "flat" (in Zeilen), "raised" (Kopfzeile), "quiet" (Fläche mit Kante), "danger".
export const IconButton = forwardRef(function IconButton({ icon, label, variant = 'flat', size = 20, className = '', type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={`ui-ibtn ui-ibtn--${variant}${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
});
