import { useState } from 'react';
import { useAuth } from './core/lib/AuthContext';
import Login from './core/components/Login';
import ModuleRegister from './core/ModuleRegister';
import LockedModule from './core/LockedModule';
import { MODULES, getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';

// Nur "finance" hat bereits eine echte Komponente. Weitere Module tragen
// hier künftig einfach ihren eigenen Eintrag ein.
const MODULE_COMPONENTS = {
  finance: FinanceModule,
};

export default function App() {
  const { session, ladeVorgang } = useAuth();
  const [activeModule, setActiveModule] = useState('finance');

  if (ladeVorgang) return <div className="loading-note">Lädt…</div>;
  if (!session) return <Login />;

  const mod = getModule(activeModule) || MODULES[0];
  const ModuleComponent = MODULE_COMPONENTS[mod.id];

  return (
    <>
      <main className="main-content module-content">
        {ModuleComponent ? <ModuleComponent /> : <LockedModule module={mod} />}
      </main>
      <ModuleRegister active={activeModule} onChange={setActiveModule} />
    </>
  );
}
