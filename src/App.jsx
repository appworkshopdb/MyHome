import { useState } from 'react';
import { useAuth } from './core/lib/AuthContext';
import Login from './core/components/Login';
import AppHeader from './core/AppHeader';
import Hub from './core/Hub';
import LockedModule from './core/LockedModule';
import { getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';

// Nur "finance" hat bereits eine echte Komponente. Weitere Module tragen
// hier künftig einfach ihren eigenen Eintrag ein.
const MODULE_COMPONENTS = {
  finance: FinanceModule,
};

export default function App() {
  const { session, ladeVorgang } = useAuth();
  // null = Hub (Landingpage nach dem Login). Modul-Wechsel läuft über
  // das Menü in AppHeader, nicht mehr über ein eigenes Register.
  const [activeModule, setActiveModule] = useState(null);

  if (ladeVorgang) return <div className="loading-note">Lädt…</div>;
  if (!session) return <Login />;

  const mod = activeModule ? getModule(activeModule) : null;
  const ModuleComponent = mod ? MODULE_COMPONENTS[mod.id] : null;

  return (
    <>
      <AppHeader activeModule={activeModule} onNavigate={setActiveModule} />
      <main className="main-content">
        {!mod && <Hub onOpenModule={setActiveModule} />}
        {mod && (ModuleComponent ? <ModuleComponent /> : <LockedModule module={mod} />)}
      </main>
    </>
  );
}
