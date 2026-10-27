// core/Statistiken.jsx
// Hub → "Statistiken": Auswahl zwischen Wochen- und Monatsüberblick.
// Routen (eigene Core-Route wie 'profile', damit die Rückblick-Pushes direkt
// verlinken können):
//   #/statistiken         → Auswahl
//   #/statistiken/woche   → Wochenüberblick  (PeriodReview kind="week")
//   #/statistiken/monat   → Monatsüberblick  (PeriodReview kind="month")

import ModuleTopBar from './components/ModuleTopBar';
import AreaList from './components/AreaList';
import AreaRow from './components/AreaRow';
import PeriodReview from './PeriodReview';

export default function Statistiken({ view, onOpenModule, hasWarnings }) {
  if (view === 'woche' || view === 'monat') {
    return (
      <PeriodReview
        key={view}
        kind={view === 'monat' ? 'month' : 'week'}
        onBack={() => onOpenModule('statistiken')}
        onOpenModule={onOpenModule}
        hasWarnings={hasWarnings}
      />
    );
  }

  return (
    <>
      <ModuleTopBar title="Statistiken" hasWarnings={hasWarnings} onBack={() => onOpenModule(null)} />
      <div className="hub with-topbar-space">
        <h1 className="overview-page-title">Statistiken</h1>
        <section className="page-section" style={{ marginTop: 16 }}>
          <AreaList>
            <AreaRow label="Wochenüberblick" onPress={() => onOpenModule('statistiken/woche')} />
            <AreaRow label="Monatsüberblick" onPress={() => onOpenModule('statistiken/monat')} />
          </AreaList>
        </section>
      </div>
    </>
  );
}
