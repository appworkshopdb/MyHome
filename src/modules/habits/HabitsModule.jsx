// modules/habits/HabitsModule.jsx
// Views (alle über Hash-URL #/habits/<view>):
//   null               → OverviewSection (Übersicht)
//   'gewohnheiten'     → HabitsView (Meine Gewohnheiten, lazy)
//   'statistik'        → StatsView Hauptseite
//   'jahresrueckblick' → Jahresrückblick (Unterseite von statistik)
//   'verlauf'          → Verlauf (Unterseite von statistik)

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import OverviewSection  from './components/OverviewSection.jsx';
import StatsView        from './components/StatsView.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

const HabitsView = lazy(() => import('./components/HabitsView.jsx'));

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';
import './habits.css';

export default function HabitsModule({ view, onNavigateView, hasWarnings }) {
  const { habits, entries, loaded } = useHabitsStore();
  const loading = !loaded;

  const [error,      setError]      = useState(null);
  const [wizardDone, setWizardDone] = useState(false);

  useEffect(() => {
    loadHabitsData({ force: true }).catch(() =>
      setError('Gewohnheiten konnten nicht geladen werden.')
    );
  }, []);

  const fetchHabits  = useCallback(() => reloadHabits(),  []);
  const fetchEntries = useCallback(() => reloadEntries(), []);

  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  const showWizard   = !loading && activeHabits.length === 0 && !wizardDone && !view;

  async function handleWizardDone() {
    await fetchHabits();
    await fetchEntries();
    setWizardDone(true);
  }

  if (loading) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="page-loading with-topbar-space">Wird geladen …</div>
      </>
    );
  }

  if (showWizard) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          <OnboardingWizard
            onDone={handleWizardDone}
            onSkip={() => setWizardDone(true)}
          />
        </div>
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

  // ── Statistik-Unterseiten (eigene URLs, Zurück → statistik) ──
  if (view === 'jahresrueckblick' || view === 'verlauf') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView('statistik')} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
          <StatsView
            habits={habits}
            entries={entries}
            subView={view}
          />
        </div>
      </>
    );
  }

  // ── Statistik-Hauptseite ──
  if (view === 'statistik') {
    return (
      <>
        <ModuleTopBar onBack={() => onNavigateView(null)} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
          <StatsView
            habits={habits}
            entries={entries}
            subView={null}
            onNavigate={onNavigateView}
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
