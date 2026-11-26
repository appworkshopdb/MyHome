// Teile für Fenster: Kopf (Titel links, Kreuz rechts) und feste Fußleiste.
// Die Hülle bleibt SheetShell (Portal, Wischen, Scroll-Sperre). Dazu ein kleiner
// Bestätigen-Dialog nur für Endgültiges; Umkehrbares bekommt einen Toast mit "Rückgängig".
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './Button.jsx';

export function SheetHeader({ id, title, sub, onClose }) {
  return (
    <div className="ui-sheet-head">
      <div className="ui-sheet-head-text">
        <h2 className="ui-sheet-title" id={id}>{title}</h2>
        {sub && <div className="ui-sheet-sub">{sub}</div>}
      </div>
      {onClose && <IconButton icon="close" label="Schließen" onClick={onClose} />}
    </div>
  );
}

// Fußleiste: Löschen bzw. Nebenaktion links, Hauptaktion rechts (füllt den Rest).
export function SheetFooter({ children }) {
  return <div className="ui-sheet-foot">{children}</div>;
}

export function ConfirmDialog({ title, text, confirmLabel = 'Löschen', danger = true, onConfirm, onClose }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="ui-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ui-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ui-dialog-title">
        <h2 className="ui-dialog-title" id="ui-dialog-title">{title}</h2>
        {text && <p className="ui-dialog-text">{text}</p>}
        <div className="ui-dialog-actions">
          <Button variant={danger ? 'danger' : 'primary'} block onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
          <Button variant="secondary" block ref={cancelRef} onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
