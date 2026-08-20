import { useAuth } from '../lib/AuthContext';
import { useRoute } from '../lib/useRoute';
import { IconHome } from './Icons';

// Ersetzt AppHeader, sobald man in einem Modul oder auf der Profil-Seite
// ist (siehe Projektkontext.md, Abschnitt "Routing"/"Modul-Kopfzeile").
// AppHeader (Zuhause-Wortmarke + Menü mit Design/Modul-Liste) bleibt
// ausschließlich dem Hub vorbehalten — von hier kommt man über das
// Home-Icon dorthin zurück, Modulwechsel läuft ab jetzt nur noch über
// diesen Umweg (bewusste Entscheidung, siehe Chat).
export default function ModuleTopBar({ title }) {
  const { session } = useAuth();
  const { navigate } = useRoute();
  const initial = (session?.user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="module-topbar">
      <button className="module-topbar-home" onClick={() => navigate('')} aria-label="Zum Start">
        <IconHome />
      </button>
      <div className="module-topbar-title">{title}</div>
      <button className="module-topbar-avatar" onClick={() => navigate('profile')} aria-label="Zum Profil">
        {initial}
      </button>
    </div>
  );
}
