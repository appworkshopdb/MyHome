import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import { IconHome } from './Icons';

// Einheitliche obere Leiste für JEDEN Modul-/Tab-Screen (Finanzen,
// Sport, Ernährung, Alltag/Einkauf-Platzhalter, gesperrte Module).
// Löst das Problem, dass es innerhalb eines Moduls (erst recht
// innerhalb eines Tabs, z.B. Finanzen → Verträge) sonst keinen Weg
// zurück zum Hub gab. Ersetzt dort core/AppHeader.jsx, das weiterhin
// NUR auf dem Hub selbst gerendert wird (siehe App.jsx) — dort bleibt
// Wortmarke + aufklappbares Menü, hier reicht "zurück" + Kontext.
export default function ModuleTopBar({ title }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="module-topbar">
      <button className="module-topbar-home" onClick={() => navigate('')} aria-label="Zum Start">
        <IconHome />
      </button>
      <div className="module-topbar-title">{title}</div>
      <button className="module-topbar-profile" onClick={() => navigate('profile')} aria-label="Zum Profil">
        <span className="module-topbar-avatar">{initial}</span>
      </button>
    </div>
  );
}
