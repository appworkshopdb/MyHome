// modules/habits/HabitsModule.jsx
// Views (alle über Hash-URL #/habits/<view>):
//   null               → OverviewSection (Übersicht)
//   'gewohnheiten'     → HabitsView (Meine Gewohnheiten, lazy)
//   'statistik'        → StatsView (Cockpit mit Zeitraum-/Gewohnheitsfilter)
//   'archiv'           → HabitArchiveView (gelöschte Gewohnheiten, lazy)

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import OverviewSection  from './components/OverviewSection.jsx';
import StatsView        from './components/StatsView.jsx';

const HabitsView = lazy(() => import('./components/HabitsView.jsx'));
const HabitArchiveView = lazy(() => import('./components/HabitArchiveView.jsx'));

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';
import { PageSkeleton, ErrorState } from '../../core/components/ui';
import './habits.css';

export default function HabitsModule({ view, onNavigateView, hasWarnings }) {
  const { habits, entries, loaded } = useHabitsStore();
  const loading = !loaded;

  const [error,      setError]      = useState(null);

  useEffect(() => {
    loadHabitsData({ force: true }).catch(() =>
      setError('Gewohnheiten konnten nicht geladen werden.')
    );
  }, []);

  const fetchHabits  = useCallback(() => reloadHabits(),  []);
  const fetchEntries = useCallback(() => reloadEntries(), []);

  if (loading) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <PageSkeleton />
      </>
    );
  }

  // ── Meine Gewohnheiten ──
  if (view === 'gewohnheiten') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView(null)} title="Meine Gewohnheiten" hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <ErrorState title={error} />}
          <Suspense fallback={<PageSkeleton />}>
            <HabitsView
              habits={habits}
              onHabitsChange={async () => { await fetchHabits(); await fetchEntries(); }}
            />
          </Suspense>
        </div>
      </>
    );
  }

  // ── Archiv ──
  if (view === 'archiv') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView(null)} title="Archiv" hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          <Suspense fallback={<PageSkeleton />}>
            <HabitArchiveView
              onHabitsChange={async () => { await fetchHabits(); await fetchEntries(); }}
            />
          </Suspense>
        </div>
      </>
    );
  }

  // ── Statistik (Cockpit) ──
  if (view === 'statistik') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView(null)} title="Statistik" hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <ErrorState title={error} />}
          <StatsView
            habits={habits}
            entries={entries}
          />
        </div>
      </>
    );
  }

  // ── Übersicht (Standard) ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="hab-module-content with-topbar-space">
        {error && <ErrorState title={error} />}
        <OverviewSection
          habits={habits}
          entries={entries}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
