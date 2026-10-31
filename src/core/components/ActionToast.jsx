import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Hinweis unten mit zwei großen Knöpfen (z.B. „Rückgängig“ / „Liste öffnen“).
// Der einfache Text-Toast aus UiContext kennt keine Aktionen. Ein dünner Balken
// unten zeigt die Restzeit, nach `duration` blendet sich der Hinweis selbst aus.
// actions: [{ label, onPress, primary? }] — jede Aktion schließt den Hinweis;
// `primary` füllt den Knopf, die anderen sind umrandet.
export default function ActionToast({ title, actions = [], duration = 10000, onClose }) {
  // onClose über eine Ref: ein neu erzeugter Callback des Aufrufers darf den Timer nicht zurücksetzen
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), duration);
    return () => window.clearTimeout(t);
  }, [duration]);

  return createPortal(
    <div className="action-toast" role="status">
      <div className="action-toast-head">
        <span className="action-toast-ok" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <b>{title}</b>
      </div>
      <div className="action-toast-btns">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`action-toast-btn${a.primary ? ' primary' : ''}`}
            onClick={() => { onClose(); a.onPress(); }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <span className="action-toast-timer" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </div>,
    document.body,
  );
}
