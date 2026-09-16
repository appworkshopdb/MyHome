// modules/habits/HabitsModule.jsx
// Einstiegspunkt des Gewohnheiten-Moduls.
//
// Views:
//   null            → OverviewSection (Übersicht)
//   'gewohnheiten'  → HabitsView (Meine Gewohnheiten, lazy)
//   'statistik'     → StatsView (zusammengeführte Statistik-Seite inkl.
//                     Unterseiten Jahresrückblick + Verlauf & Badges)
//
// Hinweis: 'verlauf' und 'auswertung' wurden zu 'statistik' zusammengeführt.
// StatsView verwaltet seine eigenen Unterseiten intern via subView-State
// und rendert dabei selbst eine ModuleTopBar mit onBack — deshalb wird
// hier für 'statistik' KEINE eigene TopBar gerendert.

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import GoalsSection     from '../../core/components/GoalsSection.jsx';

import OverviewSection  from './components/OverviewSection.jsx';
import StatsView        from './components/StatsView.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

// HabitsView lazy — zieht @dnd-kit (44 kB), nur beim Öffnen nötig
const HabitsView = lazy(() => import('./components/HabitsView.jsx'));

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';

import './habits.css';

export default function HabitsModule({ view, onNavigateView, hasWarnings }) {
  const { habits, entries, loaded } = useHabitsStore();
  const loading = !loaded;

  const [error,      setError]      = useState(null);
  const [wizardDone, setWizardDone] = useState(false);
  const [statsSubView, setStatsSubView] = useState(null); // für TopBar-Tausch

  useEffect(() => {
    loadHabitsData({ force: true }).catch(() =>
      setError('Gewohnheiten konnten nicht geladen werden.')
    );
  }, []);

  const fetchHabits  = useCallback(() => reloadHabits(),  []);
  const fetchEntries = useCallback(() => reloadEntries(), []);

  function backToOverview() { onNavigateView(null); }

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
        <ModuleTopBar onBack={backToOverview} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
          <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
            <HabitsView
              habits={habits}
              onHabitsChange={async () => {
                await fetchHabits();
                await fetchEntries();
              }}
            />
          </Suspense>
        </div>
      </>
    );
  }

  // ── Statistik ──
  // Unterseiten (Jahresrückblick / Verlauf & Badges) haben eigenen Zurück-Button
  // der zurück zur Statistik-Hauptseite führt (nicht zur Übersicht).
  if (view === 'statistik') {
    const onBack = statsSubView
      ? () => setStatsSubView(null)   // Unterseite → Hauptseite Statistik
      : backToOverview;               // Hauptseite → Übersicht
    return (
      <>
        <ModuleTopBar onBack={onBack} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>}
          <StatsView
            habits={habits}
            entries={entries}
            hasWarnings={hasWarnings}
            onSubViewChange={setStatsSubView}
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
