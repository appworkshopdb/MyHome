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
//
// Die frühere Swipe-Navigation zwischen Modulen wurde bewusst ENTFERNT
// (kollidierte mit horizontal scrollbaren Inhalten wie Heatmap/Tabs).
// Modulwechsel läuft ausschließlich über die Bottom-Nav — bitte nicht
// wieder einbauen.

import { useAuth } from './core/lib/AuthContext';
import { useRoute } from './core/lib/useRoute';
import { useRequiredDataStatus } from './core/lib/useRequiredDataStatus';
import { EntrySheetProvider } from './core/lib/EntrySheetContext';
import Login from './core/components/Login';
import ModuleTopBar from './core/components/ModuleTopBar';
import RequiredDataToast from './core/components/RequiredDataToast';
import EntrySheet from './core/components/EntrySheet';
import ModuleBottomNav from './core/components/ModuleBottomNav';
import GlobalFab from './core/components/GlobalFab';
import Hub from './core/Hub';
import Profile from './core/Profile';
import LockedModule from './core/LockedModule';
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

export default function App() {
  const { session, ladeVorgang } = useAuth();
  const { module: activeModule, view, navigate } = useRoute();
  const { warnings } = useRequiredDataStatus(session);
  const hasWarnings = warnings.length > 0;

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

      <main className={`main-content${isModule ? ' module-active' : ''}`}>
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
      <GlobalFab activeModule={activeModule} />
      <ModuleBottomNav
        active={activeModule === null ? '' : activeModule}
        onChange={navigate}
      />
    </EntrySheetProvider>
  );
}
