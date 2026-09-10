// modules/finance/FinanceModule.jsx
//
// NEU (UMBAU-PLAN.md Schritt 6): kein Stapel aus vier PageSection-Blöcken
// mehr — ohne `view` zeigt sich die Übersicht (OverviewSection: Saldo-
// Fokuskarte, "Wohin es geht", Bereiche), mit `view` genau EIN Bereich
// als Vollbild-Detail-Screen mit Zurück-Pfeil und zentriertem Titel.
//
// Nebeneffekt: SummaryView (chart.js + react-chartjs-2, zusammen 177 kB)
// lädt jetzt erst beim Öffnen des Bereichs "Auswertung" — vorher zog es
// bei jedem Öffnen des Moduls mit, weil es auf der zusammengelegten
// Seite immer im Baum stand.
//
// Neue Einträge laufen weiterhin ausschließlich über den globalen FAB
// (EntrySheet); die "+Fixkosten"/"+Vertrag"-Buttons in ContractsView
// legen etwas anderes an (wiederkehrende Vorlagen) und bleiben dort.

import { lazy, Suspense } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import OverviewSection from './components/OverviewSection';
import MonthsView from './components/MonthsView';
import ContractsView from './components/ContractsView';
import SettingsView from './components/SettingsView';

const SummaryView = lazy(() => import('./components/SummaryView'));

// Bereich-Key → Titel für die Detail-TopBar (zentriert, siehe ModuleTopBar.jsx)
const DETAIL_TITLES = {
  buchungen:     'Buchungen',
  offen:         'Offene Posten',
  vertraege:     'Verträge',
  auswertung:    'Auswertung',
  einstellungen: 'Einstellungen',
};

export default function FinanceModule({ view, onNavigateView, hasWarnings }) {
  function backToOverview() { onNavigateView(null); }

  // ── Detail-Screens: ein Bereich pro Screen ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="fin-module-content with-topbar-space">
          {/* "Buchungen" und "Offene Posten" sind derselbe Screen mit
              unterschiedlichem Startfilter — MonthsView kann das bereits,
              der Filter war nur nicht von außen setzbar. */}
          {view === 'buchungen' && <MonthsView />}
          {view === 'offen'     && <MonthsView initialFilter="offen" />}

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

  // ── Übersicht ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="fin-module-content with-topbar-space">
        <OverviewSection onNavigate={onNavigateView} />
      </div>
    </>
  );
}
