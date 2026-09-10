// modules/habits/HabitsModule.jsx
// Einstiegspunkt des Gewohnheiten-Moduls.
//
// NEU (UMBAU-PLAN.md Schritt 5): kein durchlaufendes Stapeln von vier
// Sektionen mehr — ohne `view` zeigt sich die Übersicht (OverviewSection:
// Ring-Fokuskarte, "Offen heute", "Bereiche"), mit `view` genau EIN
// Bereich als Vollbild-Detail-Screen. "+ Neue Gewohnheit" läuft weiterhin
// ausschließlich über den globalen FAB (HabitQuickSheet).

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import GoalsSection     from '../../core/components/GoalsSection.jsx';

import OverviewSection  from './components/OverviewSection.jsx';
// Getrennt geladen: HabitsView zieht @dnd-kit fuer die Sortierung nach
// (44 kB) — jetzt nur noch beim Öffnen des Bereichs "Meine Gewohnheiten"
// nötig, nicht mehr bei jedem Modul-Öffnen wie zur Zeit der Tab-Flachlegung.
const HabitsView = lazy(() => import('./components/HabitsView.jsx'));
import CalendarView     from './components/CalendarView.jsx';
import StatsView        from './components/StatsView.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';

import './habits.css';

// Bereich-Key → Titel für die Detail-TopBar (zentriert, siehe ModuleTopBar.jsx)
const DETAIL_TITLES = {
  gewohnheiten: 'Meine Gewohnheiten',
  verlauf:      'Verlauf',
  auswertung:   'Auswertung',
};

export default function HabitsModule({ view, onNavigateView, hasWarnings }) {
  // Gemeinsamer Store — dieselben Daten wie im Hub.
  // Abhaken hier ist sofort im Hub sichtbar und umgekehrt.
  const { habits, entries, loaded } = useHabitsStore();
  const loading = !loaded;

  const [error,      setError]      = useState(null);
  // Wizard anzeigen wenn keine Habits vorhanden und noch nicht übersprungen
  const [wizardDone, setWizardDone] = useState(false);

  // Beim Öffnen des Moduls frische Daten holen (falls zwischenzeitlich
  // woanders etwas geändert wurde)
  useEffect(() => {
    loadHabitsData({ force: true }).catch(() =>
      setError('Gewohnheiten konnten nicht geladen werden.')
    );
  }, []);

  const fetchHabits  = useCallback(() => reloadHabits(),  []);
  const fetchEntries = useCallback(() => reloadEntries(), []);

  function backToOverview() { onNavigateView(null); }

  // Wizard zeigen wenn: geladen, keine aktiven Habits, noch nicht weggeklickt
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

  // Wizard fullscreen — vor der eigentlichen Seite
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

  // ── Detail-Screens: ein Bereich pro Screen, Zurück führt immer auf
  // die Übersicht, nicht in den Browser-Verlauf hinein. ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="hab-module-content with-topbar-space">
          {error && (
            <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          {view === 'gewohnheiten' && (
            <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
              <HabitsView
                habits={habits}
                onHabitsChange={async () => {
                  await fetchHabits();
                  await fetchEntries();
                }}
              />
            </Suspense>
          )}

          {view === 'verlauf' && (
            <CalendarView habits={habits} entries={entries} />
          )}

          {view === 'auswertung' && (
            <>
              <StatsView habits={habits} entries={entries} />
              {/* Ziele-Sektion (UMBAU-PLAN.md: "wandert in Auswertung") */}
              <GoalsSection sourceModule="habits" />
            </>
          )}
        </div>
      </>
    );
  }

  // ── Übersicht ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="hab-module-content with-topbar-space">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}
        <OverviewSection
          habits={habits}
          entries={entries}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
