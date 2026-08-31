// src/App.jsx
// Schritt 3: Schwebende Chrome.
//
// Strategie: App.jsx rendert ModuleTopBar für Hub + Profil global.
// Module rendern ihre eigene ModuleTopBar-Instanz (für Tab-Titel und
// onBack) — dabei wird hasWarnings jetzt global aus dem Store geholt
// und als Prop übergeben, damit der Warnpunkt auf ALLEN Screens erscheint.
// Module erhalten hasWarnings via onNavigateView-Props-Kette NICHT —
// stattdessen akzeptiert ModuleTopBar hasWarnings als optionalen Prop
// und Module müssen ihn nicht übergeben; das erledigt App.jsx für
// Hub+Profil, Module via useRequiredDataStatus direkt.
//
// In Schritt 4–7 werden die Modul-eigenen ModuleTopBar-Aufrufe
// auf den globalen ChromeContext umgestellt.

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

const MODULE_COMPONENTS = {
  finance:   FinanceModule,
  nutrition: NutritionModule,
  sport:     SportModule,
  habits:    HabitsModule,
  shopping:  ShoppingModule,
};

const SWIPE_ORDER = [null, 'habits', 'finance', 'sport', 'nutrition', 'shopping'];
const SWIPE_MIN_X = 60;
const SWIPE_MAX_Y = 80;

export default function App() {
  const { session, ladeVorgang } = useAuth();
  const { module: activeModule, view, navigate } = useRoute();
  const { warnings } = useRequiredDataStatus(session);
  const hasWarnings = warnings.length > 0;

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

    if (Math.abs(dx) < SWIPE_MIN_X || dy > SWIPE_MAX_Y) return;
    if (activeModule === 'profile') return;

    const currentIndex = SWIPE_ORDER.indexOf(activeModule);
    if (currentIndex === -1) return;

    if (dx < 0) {
      const next = SWIPE_ORDER[currentIndex + 1];
      if (next !== undefined) navigate(next ?? '');
    } else {
      const prev = SWIPE_ORDER[currentIndex - 1];
      if (prev !== undefined) navigate(prev ?? '');
    }
  }

  if (ladeVorgang) return <div className="loading-note">Lädt…</div>;
  if (!session) return <Login />;

  const isModule = activeModule && activeModule !== 'profile';
  const mod = isModule ? getModule(activeModule) : null;
  const ModuleComponent = mod?.built ? MODULE_COMPONENTS[mod.id] : null;

  // Hub und Profil: App.jsx rendert ModuleTopBar global.
  // Module rendern ihre eigene Instanz (mit Tab-Titel / onBack),
  // bekommen hasWarnings als Prop übergeben (Schritt 4–7 löst das sauber).
  const showGlobalTopBar = activeModule === null || activeModule === 'profile';
  const globalTitle = activeModule === null ? 'Zuhause' : 'Profil';

  return (
    <EntrySheetProvider>
      {showGlobalTopBar && (
        <ModuleTopBar title={globalTitle} hasWarnings={hasWarnings} />
      )}

      <main
        className={`main-content${isModule ? ' module-active' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeModule === null && <Hub onOpenModule={navigate} />}
        {activeModule === 'profile' && <Profile onOpenModule={navigate} />}
        {mod && (ModuleComponent ? (
          <ModuleComponent
            module={mod}
            view={view}
            hasWarnings={hasWarnings}
            onNavigateView={(v) => navigate(v ? `${mod.id}/${v}` : mod.id)}
          />
        ) : (
          <LockedModule module={mod} />
        ))}
      </main>

      <RequiredDataToast warnings={warnings} onFix={navigate} />
      <EntrySheet />
      <ModuleBottomNav
        active={activeModule === null ? '' : activeModule}
        onChange={navigate}
      />
    </EntrySheetProvider>
  );
}
