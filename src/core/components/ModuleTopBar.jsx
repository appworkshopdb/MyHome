import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import { IconHome, IconBack } from './Icons';

// Einheitliche obere Leiste für JEDEN Modul-/Tab-Screen.
// onBack (optional): zeigt statt Home-Icon einen Zurück-Pfeil.
//   → navigiert zurück ohne den Hub aufzurufen (z.B. Liste → Listenübersicht)
export default function ModuleTopBar({ title, onBack }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const initial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="module-topbar">
      {onBack ? (
        <button className="module-topbar-home" onClick={onBack} aria-label="Zurück">
          <IconBack />
        </button>
      ) : (
        <button className="module-topbar-home" onClick={() => navigate('')} aria-label="Zum Start">
          <IconHome />
        </button>
      )}
      <div className="module-topbar-title">{title}</div>
      <button className="module-topbar-profile" onClick={() => navigate('profile')} aria-label="Zum Profil">
        <span className="module-topbar-avatar">{initial}</span>
      </button>
    </div>
  );
}
