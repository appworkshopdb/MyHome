import { lazy, Suspense } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import PageSection from '../../core/components/PageSection';
import MonthsView from './components/MonthsView';
import ContractsView from './components/ContractsView';
import SettingsView from './components/SettingsView';

// Getrennt geladen: SummaryView zieht chart.js + react-chartjs-2 nach
// (zusammen 177 kB). Bleibt hinter Suspense, damit der Rest der Seite
// (Monat, Verträge) sofort sichtbar ist, während dieser Abschnitt im
// Hintergrund nachlädt — lädt jetzt zwar bei jedem Öffnen des Moduls
// mit (vorher nur bei Tab-Klick), aber blockiert den ersten Render nicht.
const SummaryView = lazy(() => import('./components/SummaryView'));

// KEINE TABS MEHR: Monat/Verträge/Auswertung/Einstellungen liegen als
// vier PageSection-Blöcke untereinander, in derselben Reihenfolge wie
// die früheren Tabs. Keine eigenen "+"-Konflikte mit dem globalen FAB
// hier — MonthsView hatte schon keinen eigenen Neu-Button (Einträge
// laufen über den FAB → EntrySheet), und die "+Fixkosten"/"+Vertrag"-
// Buttons in ContractsView legen etwas anderes an (wiederkehrende
// Vorlagen, nicht einzelne Buchungen) und bleiben unverändert bestehen.
export default function FinanceModule({ hasWarnings }) {
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />

      <div className="fin-module-content with-topbar-space">
        <PageSection title="Monat">
          <MonthsView />
        </PageSection>

        <PageSection title="Verträge">
          <ContractsView />
        </PageSection>

        <PageSection title="Auswertung">
          <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
            <SummaryView />
          </Suspense>
        </PageSection>

        <PageSection title="Einstellungen">
          <SettingsView />
        </PageSection>
      </div>
    </>
  );
}
