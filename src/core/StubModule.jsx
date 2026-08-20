import GoalsSection from './components/GoalsSection';
import ModuleTopBar from './components/ModuleTopBar';

// NUR zum Testen: zeigt kein echtes Modul, sondern hält die App-Hülle
// (Menü, Ziele-Muster) für Module durchklickbar, die noch keinen
// eigenen Bildschirm haben. Vor dem echten Launch entweder durch die
// richtige <XyzModule/> ersetzen oder module.built wieder auf false
// setzen — dann greift automatisch wieder LockedModule.jsx.
export default function StubModule({ module }) {
  return (
    <>
      <ModuleTopBar title={module.name} />
      <div className="hub">
        <div className="page-header">
          <p style={{ marginTop: 2 }}>Platzhalter — Modul wird noch gebaut, nur zum Testen freigeschaltet.</p>
        </div>
        <GoalsSection sourceModule={module.id} />
      </div>
    </>
  );
}
