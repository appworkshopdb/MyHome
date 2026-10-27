// modules/habits/HabitsModule.jsx
// Views (alle über Hash-URL #/habits/<view>):
//   null               → OverviewSection (Übersicht)
//   'gewohnheiten'     → HabitsView (Meine Gewohnheiten, lazy)
//   'statistik'        → StatsView (Cockpit mit Zeitraum-/Gewohnheitsfilter)

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import OverviewSection  from './components/OverviewSection.jsx';
import StatsView        from './components/StatsView.jsx';

const HabitsView = lazy(() => import('./components/HabitsView.jsx'));

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';
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
        <div className="page-loading with-topbar-space">Wird geladen …</div>
      </>
    );
  }

  // ── Meine Gewohnheiten ──
  if (view === 'gewohnheiten') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView(null)} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
          <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
            <HabitsView
              habits={habits}
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
        <ModuleTopBar onBack={() => onNavigateView(null)} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
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
        {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
        <OverviewSection
          habits={habits}
          entries={entries}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
