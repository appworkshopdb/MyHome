import { useAuth } from './core/lib/AuthContext';
import { useRoute } from './core/lib/useRoute';
import { useRequiredDataStatus } from './core/lib/useRequiredDataStatus';
import { EntrySheetProvider } from './core/lib/EntrySheetContext';
import Login from './core/components/Login';
import AppHeader from './core/AppHeader';
import RequiredDataToast from './core/components/RequiredDataToast';
import EntrySheet from './core/components/EntrySheet';
import Hub from './core/Hub';
import Profile from './core/Profile';
import LockedModule from './core/LockedModule';
import StubModule from './core/StubModule';
import { getModule } from './core/modules';
import FinanceModule from './modules/finance/FinanceModule';
import NutritionModule from './modules/nutrition/NutritionModule';
import SportModule from './modules/sport/SportModule';

// Weitere Module tragen hier künftig einfach ihren eigenen Eintrag ein.
// module.built steuert (in App.jsx unten), ob überhaupt gerendert wird —
// ein Eintrag hier allein schaltet noch nichts frei.
const MODULE_COMPONENTS = {
  finance: FinanceModule,
  nutrition: NutritionModule,
  sport: SportModule,
  everyday: StubModule,
  shopping: StubModule,
  habits: StubModule,
};

export default function App() {
  const { session, ladeVorgang } = useAuth();
  // module: null = Hub (Landingpage), 'profile' = Profil-Seite, sonst
  // Modul-Id. view: Unteransicht innerhalb eines Moduls. Kommt komplett
  // aus der URL (core/lib/useRoute.js) — dadurch übersteht der aktuelle
  // Bildschirm einen Reload, statt immer zurück zum Hub zu springen, und
  // jede Ansicht hat automatisch einen eigenen, teilbaren Link.
  const { module: activeModule, view, navigate } = useRoute();

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
    <EntrySheetProvider>
      {activeModule === null && (
        <AppHeader onNavigate={navigate} hasWarnings={warnings.length > 0} />
      )}
      <main className="main-content">
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
    </EntrySheetProvider>
  );
}
