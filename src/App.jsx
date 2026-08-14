import { useState } from 'react';
import { useAuth } from './core/lib/AuthContext';
import { useRequiredDataStatus } from './core/lib/useRequiredDataStatus';
import Login from './core/components/Login';
import AppHeader from './core/AppHeader';
import RequiredDataToast from './core/components/RequiredDataToast';
import Hub from './core/Hub';
import Profile from './core/Profile';
import LockedModule from './core/LockedModule';
import { getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';
import NutritionModule from './modules/nutrition/NutritionModule';
import SportModule from './modules/sport/SportModule';

// Weitere Module tragen hier künftig einfach ihren eigenen Eintrag ein.
const MODULE_COMPONENTS = {
  finance: FinanceModule,
  nutrition: NutritionModule,
  sport: SportModule,
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
  const ModuleComponent = mod ? MODULE_COMPONENTS[mod.id] : null;

  return (
    <>
      <AppHeader activeModule={activeModule} onNavigate={setActiveModule} hasWarnings={warnings.length > 0} />
      <main className="main-content">
        {activeModule === null && <Hub onOpenModule={setActiveModule} />}
        {activeModule === 'profile' && <Profile onOpenModule={setActiveModule} />}
        {mod && (ModuleComponent ? <ModuleComponent /> : <LockedModule module={mod} />)}
      </main>
      <RequiredDataToast warnings={warnings} onFix={setActiveModule} />
    </>
  );
}
