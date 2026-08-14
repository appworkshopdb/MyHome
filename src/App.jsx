import { useState } from 'react';
import { useAuth } from './core/lib/AuthContext';
import { useRequiredDataStatus } from './core/lib/useRequiredDataStatus';
import Login from './core/components/Login';
import AppHeader from './core/AppHeader';
import RequiredDataToast from './core/components/RequiredDataToast';
import Hub from './core/Hub';
import Profile from './core/Profile';
import LockedModule from './core/LockedModule';
import StubModule from './core/StubModule';
import { getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';
import NutritionModule from './modules/nutrition/NutritionModule';

// Weitere Module tragen hier künftig einfach ihren eigenen Eintrag ein.
// module.built steuert (in App.jsx unten), ob überhaupt gerendert wird —
// ein Eintrag hier allein schaltet noch nichts frei.
const MODULE_COMPONENTS = {
  finance: FinanceModule,
  nutrition: NutritionModule,
  everyday: StubModule,
  shopping: StubModule,
  sport: StubModule,
  habits: StubModule,
};

export default function App() {
  const { session, ladeVorgang } = useAuth();
  // null = Hub (Landingpage), 'profile' = Profil-Seite, sonst Modul-Id.
  // Modul-Wechsel läuft über das Menü in AppHeader, nicht mehr über ein
  // eigenes Register.
  const [activeModule, setActiveModule] = useState(null);

  // App-weit geladen (nicht nur im Hub), damit Popup + Menü-Warnpunkt
  // auf jedem Screen aktuell sind — siehe useRequiredDataStatus.js.
  const { warnings } = useRequiredDataStatus(session);

  if (ladeVorgang) return <div className="loading-note">Lädt…</div>;
  if (!session) return <Login />;

  const isModule = activeModule && activeModule !== 'profile';
  const mod = isModule ? getModule(activeModule) : null;
  // built ist der EINE Schalter: false → immer LockedModule, egal ob
  // zufällig eine Komponente registriert ist. So lässt sich vor dem
  // echten Launch alles mit einer Zeile in modules.js wieder sperren.
  const ModuleComponent = mod?.built ? MODULE_COMPONENTS[mod.id] : null;

  return (
    <>
      <AppHeader activeModule={activeModule} onNavigate={setActiveModule} hasWarnings={warnings.length > 0} />
      <main className="main-content">
        {activeModule === null && <Hub onOpenModule={setActiveModule} />}
        {activeModule === 'profile' && <Profile onOpenModule={setActiveModule} />}
        {mod && (ModuleComponent ? <ModuleComponent module={mod} /> : <LockedModule module={mod} />)}
      </main>
      <RequiredDataToast warnings={warnings} onFix={setActiveModule} />
    </>
  );
}
