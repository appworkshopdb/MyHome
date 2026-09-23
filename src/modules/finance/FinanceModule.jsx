// modules/finance/FinanceModule.jsx
//
// NEU (UMBAU-PLAN.md Schritt 6): kein Stapel aus vier PageSection-Blöcken
// mehr — ohne `view` zeigt sich die Übersicht, mit `view` genau EIN Bereich
// als Vollbild-Detail-Screen.

import { lazy, Suspense } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import OverviewSection from './components/OverviewSection';
import MonthsView from './components/MonthsView';
import ContractsView from './components/ContractsView';
import SettingsView from './components/SettingsView';

const SummaryView = lazy(() => import('./components/SummaryView'));

const DETAIL_TITLES = {
  buchungen: 'Buchungen',
  offen: 'Offene Posten',
  vertraege: 'Verträge',
  auswertung: 'Auswertung',
  einstellungen: 'Einstellungen',
};

export default function FinanceModule({ view, onNavigateView, hasWarnings }) {
  function backToOverview() { onNavigateView(null); }

  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="fin-module-content with-topbar-space">
          {view === 'buchungen' && <MonthsView />}
          {view === 'offen' && <MonthsView initialFilter="offen" />}
          {view === 'vertraege' && <ContractsView />}
          {view === 'auswertung' && (
            <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
              <SummaryView />
            </Suspense>
          )}
          {view === 'einstellungen' && <SettingsView />}
        </div>
      </>
    );
  }

  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="fin-module-content with-topbar-space">
        <OverviewSection onNavigate={onNavigateView} />
      </div>
    </>
  );
}
