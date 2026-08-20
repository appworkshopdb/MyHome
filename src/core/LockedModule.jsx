import ModuleTopBar from './components/ModuleTopBar';

export default function LockedModule({ module }) {
  return (
    <div className="locked-module">
      <ModuleTopBar title={module.name} />
      <span className="locked-pill" style={{ background: module.color }}>Modul</span>
      <h1 style={{ marginTop: 14 }}>{module.name}</h1>
      <p style={{ marginTop: 8, maxWidth: '32ch', marginLeft: 'auto', marginRight: 'auto' }}>
        Dieses Modul ist im Konzept vorgesehen, aber noch nicht gebaut.
        {module.tier === 'paid'
          ? ` Geplanter Preis: ${module.price} (einmalig, kein Abo).`
          : ' Es wird kostenlos verfügbar sein.'}
      </p>
      <button className="btn btn-secondary" disabled style={{ marginTop: 18 }}>
        Noch nicht verfügbar
      </button>
    </div>
  );
}
