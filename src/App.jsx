import { useAuth } from './core/lib/AuthContext';
import { useRoute } from './core/lib/useRoute';
import { useRequiredDataStatus } from './core/lib/useRequiredDataStatus';
import { EntrySheetProvider } from './core/lib/EntrySheetContext';
import { useRef } from 'react';
import Login from './core/components/Login';
import ModuleTopBar from './core/components/ModuleTopBar';
import RequiredDataToast from './core/components/RequiredDataToast';
import EntrySheet from './core/components/EntrySheet';
import ModuleBottomNav from './core/components/ModuleBottomNav';
import Hub from './core/Hub';
import Profile from './core/Profile';
import LockedModule from './core/LockedModule';
import StubModule from './core/StubModule';
import { getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';
import NutritionModule from './modules/nutrition/NutritionModule';
import SportModule from './modules/sport/SportModule';
import HabitsModule from './modules/habits/HabitsModule';
import ShoppingModule from './modules/shopping/ShoppingModule';
// Weitere Module tragen hier künftig einfach ihren eigenen Eintrag ein.
// module.built steuert (in App.jsx unten), ob überhaupt gerendert wird —
// ein Eintrag hier allein schaltet noch nichts frei.
const MODULE_COMPONENTS = {
  finance:   FinanceModule,
  nutrition: NutritionModule,
  sport:     SportModule,
  habits:    HabitsModule,
  shopping:  ShoppingModule,
};
// Reihenfolge der Screens für Swipe-Navigation — muss mit Bottom-Nav übereinstimmen.
// null = Hub, dann die 5 Module in der Reihenfolge der Nav-Buttons.
const SWIPE_ORDER = [null, 'habits', 'finance', 'sport', 'nutrition', 'shopping'];

// Mindest-Swipe-Distanz (px) und maximale vertikale Abweichung
const SWIPE_MIN_X = 60;
const SWIPE_MAX_Y = 80; // verhindert Auslösung bei diagonalem Scrollen

export default function App() {
  const { session, ladeVorgang } = useAuth();
  const { module: activeModule, view, navigate } = useRoute();
  const { warnings } = useRequiredDataStatus(session);

  // Touch-Start-Koordinaten merken
  const touchStart = useRef(null);

  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    touchStart.current = null;

    // Zu kurz, zu diagonal, oder Profil-Screen → ignorieren
    if (Math.abs(dx) < SWIPE_MIN_X || dy > SWIPE_MAX_Y) return;
    if (activeModule === 'profile') return;

    const currentIndex = SWIPE_ORDER.indexOf(activeModule);
    if (currentIndex === -1) return;

    if (dx < 0) {
      // Swipe links → nächstes Modul
      const next = SWIPE_ORDER[currentIndex + 1];
      if (next !== undefined) navigate(next ?? '');
    } else {
      // Swipe rechts → vorheriges Modul
      const prev = SWIPE_ORDER[currentIndex - 1];
      if (prev !== undefined) navigate(prev ?? '');
    }
  }

  if (ladeVorgang) return <div className="loading-note">Lädt…</div>;
  if (!session) return <Login />;

  const isModule = activeModule && activeModule !== 'profile';
  const mod = isModule ? getModule(activeModule) : null;
  const ModuleComponent = mod?.built ? MODULE_COMPONENTS[mod.id] : null;

  return (
    <EntrySheetProvider>
      {activeModule === null && (
        <ModuleTopBar title="Zuhause" hasWarnings={warnings.length > 0} />
      )}
      <main
        className="main-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeModule === null && <Hub onOpenModule={navigate} />}
        {activeModule === 'profile' && <Profile onOpenModule={navigate} />}
        {mod && (ModuleComponent ? (
          <ModuleComponent
            module={mod}
            view={view}
            onNavigateView={(v) => navigate(v ? `${mod.id}/${v}` : mod.id)}
          />
        ) : (
          <LockedModule module={mod} />
        ))}
      </main>
      <RequiredDataToast warnings={warnings} onFix={navigate} />
      <EntrySheet />
      <ModuleBottomNav active={activeModule === null ? '' : activeModule} onChange={navigate} />
    </EntrySheetProvider>
  );
}
