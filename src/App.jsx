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

import { lazy, Suspense } from 'react';
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

// Module werden erst geladen, wenn man sie betritt (Code-Splitting).
// Vorher steckte die gesamte App in EINER 1,23-MB-Datei — jeder Nutzer lud
// beim Start des Hubs u.a. die komplette Ernährungs-Datenbank (316 kB) und
// chart.js (177 kB) mit, ohne sie je zu öffnen.
//
// Login, Hub und Profil bleiben bewusst statisch importiert: Login ist der
// allererste Screen, Hub der Startpunkt nach dem Anmelden. Beide nachträglich
// zu laden würde den Start verlangsamen statt beschleunigen.
const FinanceModule   = lazy(() => import('./modules/finance/FinanceModule'));
const NutritionModule = lazy(() => import('./modules/nutrition/NutritionModule'));
const SportModule     = lazy(() => import('./modules/sport/SportModule'));
const HabitsModule    = lazy(() => import('./modules/habits/HabitsModule'));
const ShoppingModule  = lazy(() => import('./modules/shopping/ShoppingModule'));

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
          // Fallback bewusst leer statt Spinner: der Modul-Chunk ist klein
          // und lokal gecacht, ein aufblitzender Ladeindikator würde nur
          // flackern. Die Chrome (TopBar/BottomNav) steht ohnehin schon.
          <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
            <ModuleComponent
              module={mod}
              view={view}
              hasWarnings={hasWarnings}
              onNavigateView={(v) => navigate(v ? `${mod.id}/${v}` : mod.id)}
            />
          </Suspense>
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
