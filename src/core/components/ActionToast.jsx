import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Kurzer Hinweis unten mit Knöpfen (z.B. „Rückgängig“). Der einfache Text-Toast
// aus UiContext kennt keine Aktionen. Blendet sich nach `duration` selbst aus.
// actions: [{ label, onPress }] — jede Aktion schließt den Hinweis.
export default function ActionToast({ title, text, actions = [], duration = 8000, onClose }) {
  // onClose über eine Ref: ein neu erzeugter Callback des Aufrufers darf den Timer nicht zurücksetzen
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), duration);
    return () => window.clearTimeout(t);
  }, [duration]);

  return createPortal(
    <div className="action-toast" role="status">
      <span className="action-toast-ok" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <span className="action-toast-tx"><b>{title}</b>{text}</span>
      {actions.map((a) => (
        <button key={a.label} type="button" className="action-toast-btn" onClick={() => { onClose(); a.onPress(); }}>{a.label}</button>
      ))}
    </div>,
    document.body,
  );
}
