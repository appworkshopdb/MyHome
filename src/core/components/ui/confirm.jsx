// Rückfrage als Aufruf: `if (!(await confirmDialog({ title: 'Eintrag löschen?' }))) return;`
// Ersetzt window.confirm. Nur für Endgültiges; Umkehrbares passiert sofort, mit Hinweis (Toast).
// Das Fenster hängt sich selbst an <body>, braucht also weder State noch JSX in der Seite.
import { createRoot } from 'react-dom/client';
import { ConfirmDialog } from './Sheet.jsx';

export function confirmDialog({ title, text, confirmLabel = 'Löschen', danger = true }) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (ok) => {
      resolve(ok);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(
      <ConfirmDialog
        title={title}
        text={text}
        confirmLabel={confirmLabel}
        danger={danger}
        onConfirm={() => resolve(true)}
        onClose={() => finish(false)}
      />,
    );
  });
}
