// modules/habits/HabitsModule.jsx
// Einstiegspunkt des Gewohnheiten-Moduls

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar     from '../../core/components/ModuleTopBar.jsx';
import ModuleTabs       from '../../core/components/ModuleTabs.jsx';
import GoalsSection     from '../../core/components/GoalsSection.jsx';

import TodayView        from './components/TodayView.jsx';
import HabitsView       from './components/HabitsView.jsx';
import CalendarView     from './components/CalendarView.jsx';
import StatsView        from './components/StatsView.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

import { useHabitsStore, loadHabitsData, reloadHabits, reloadEntries } from '../../core/lib/habitsStore.js';

import './habits.css';

const TABS = [
  { key: 'today',    label: 'Heute'        },
  { key: 'habits',   label: 'Gewohnheiten' },
  { key: 'calendar', label: 'Verlauf'      },
  { key: 'stats',    label: 'Auswertung'   },
];

const DEFAULT_VIEW = 'today';

export default function HabitsModule({ view, onNavigateView, hasWarnings }) {
  const activeTab = view || DEFAULT_VIEW;

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

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Gewohnheiten';

  // Wizard zeigen wenn: geladen, keine aktiven Habits, noch nicht weggeklickt
  const activeHabits   = habits.filter((h) => h.active && !h.deleted_at);
  const showWizard     = !loading && activeHabits.length === 0 && !wizardDone;

  async function handleWizardDone() {
    await fetchHabits();
    await fetchEntries();
    setWizardDone(true);
    onNavigateView('today'); // nach Wizard direkt zur Heute-Ansicht
  }

  if (loading) {
    return (
      <>
        <ModuleTopBar title="Gewohnheiten" hasWarnings={hasWarnings} />
        <div className="page-loading with-topbar-space">Wird geladen …</div>
      </>
    );
  }

  // Wizard fullscreen — ohne Tabs
  if (showWizard) {
    return (
      <>
        <ModuleTopBar title="Gewohnheiten" hasWarnings={hasWarnings} />
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
      <ModuleTopBar title={tabLabel} hasWarnings={hasWarnings} />
      <ModuleTabs
        items={TABS}
        active={activeTab}
        onChange={onNavigateView}
      />

      <div className="hab-module-content">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {activeTab === 'today' && (
          <TodayView
            habits={habits}
            entries={entries}
            onEntriesChange={fetchEntries}
            onNavigateToHabits={() => onNavigateView('habits')}
          />
        )}

        {activeTab === 'habits' && (
          <>
            <HabitsView
              habits={habits}
              onHabitsChange={async () => {
                await fetchHabits();
                await fetchEntries();
              }}
            />
            <GoalsSection sourceModule="habits" />
          </>
        )}

        {activeTab === 'calendar' && (
          <CalendarView habits={habits} entries={entries} />
        )}

        {activeTab === 'stats' && (
          <StatsView habits={habits} entries={entries} />
        )}
      </div>
    </>
  );
}
