import { getModule } from '../modules';
import { IconChevronRight } from './Icons';

// Bewusst kein Auto-Dismiss (anders als der normale .toast) — bleibt
// sichtbar, solange irgendein Modul Pflichtdaten vermisst, auf jedem
// Screen (wird von App.jsx neben AppHeader gerendert, nicht im Hub).
export default function RequiredDataToast({ warnings, onFix }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="required-toast-stack">
      {warnings.map((w) => {
        const mod = getModule(w.moduleId);
        const label = w.moduleId === 'profile' ? 'Profil' : (mod?.name || w.moduleId);
        return (
          <button key={w.moduleId} className="required-toast" onClick={() => onFix(w.moduleId)}>
            <span className="required-toast-dot" />
            <span className="required-toast-text">
              <span className="required-toast-title">{label}</span>
              <span className="required-toast-sub">Fehlt: {w.missing.map((m) => m.label).join(', ')}</span>
            </span>
            <IconChevronRight />
          </button>
        );
      })}
    </div>
  );
}
