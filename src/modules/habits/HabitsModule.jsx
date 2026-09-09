// modules/habits/HabitsModule.jsx
// Einstiegspunkt des Gewohnheiten-Moduls.
//
// KEINE TABS MEHR: Heute/Gewohnheiten/Verlauf/Auswertung liegen als vier
// PageSection-Blöcke untereinander auf einer durchlaufenden Seite, in
// derselben Reihenfolge wie die früheren Tabs. "+ Neue Gewohnheit" läuft
// jetzt ausschließlich über den globalen FAB (core/components/GlobalFab.jsx
// → HabitQuickSheet) — der Button innerhalb von HabitsView wurde entfernt,
// siehe habits.css/HabitsView.jsx.

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import PageSection      from '../../core/components/PageSection.jsx';
import GoalsSection     from '../../core/components/GoalsSection.jsx';

import TodayView        from './components/TodayView.jsx';
// Getrennt geladen: HabitsView zieht @dnd-kit fuer die Sortierung nach
// (44 kB). Läuft über Suspense, damit der Rest der Seite (Heute-Bereich)
// sofort sichtbar ist, während dieser Abschnitt im Hintergrund nachlädt.
const HabitsView = lazy(() => import('./components/HabitsView.jsx'));
import CalendarView     from './components/CalendarView.jsx';
import StatsView        from './components/StatsView.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';

import './habits.css';

export default function HabitsModule({ hasWarnings }) {
  // Gemeinsamer Store — dieselben Daten wie im Hub.
  // Abhaken hier ist sofort im Hub sichtbar und umgekehrt.
  const { habits, entries, loaded } = useHabitsStore();
  const loading = !loaded;

  const [error,      setError]      = useState(null);
  // Wizard anzeigen wenn keine Habits vorhanden und noch nicht übersprungen
  const [wizardDone, setWizardDone] = useState(false);

  // Sprungziel für "Springe zu Gewohnheiten" aus dem Heute-Bereich —
  // ersetzt den früheren Tab-Wechsel durch Herunterscrollen zur Sektion.
  const habitsAnchorRef = useRef(null);
  function scrollToHabitsSection() {
    habitsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Beim Öffnen des Moduls frische Daten holen (falls zwischenzeitlich
  // woanders etwas geändert wurde)
  useEffect(() => {
    loadHabitsData({ force: true }).catch(() =>
      setError('Gewohnheiten konnten nicht geladen werden.')
    );
  }, []);

  const fetchHabits  = useCallback(() => reloadHabits(),  []);
  const fetchEntries = useCallback(() => reloadEntries(), []);

  // Wizard zeigen wenn: geladen, keine aktiven Habits, noch nicht weggeklickt
  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  const showWizard   = !loading && activeHabits.length === 0 && !wizardDone;

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

  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />

      <div className="hab-module-content with-topbar-space">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        <PageSection title="Heute">
          <TodayView
            habits={habits}
            entries={entries}
            onEntriesChange={fetchEntries}
            onNavigateToHabits={scrollToHabitsSection}
          />
        </PageSection>

        <div ref={habitsAnchorRef} />
        <PageSection title="Gewohnheiten">
          <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
            <HabitsView
              habits={habits}
              onHabitsChange={async () => {
                await fetchHabits();
                await fetchEntries();
              }}
            />
            <GoalsSection sourceModule="habits" />
          </Suspense>
        </PageSection>

        <PageSection title="Verlauf">
          <CalendarView habits={habits} entries={entries} />
        </PageSection>

        <PageSection title="Auswertung">
          <StatsView habits={habits} entries={entries} />
        </PageSection>
      </div>
    </>
  );
}
