import ModuleTabs from '../../core/components/ModuleTabs';
import MonthsView from './components/MonthsView';
import SummaryView from './components/SummaryView';
import ContractsView from './components/ContractsView';
import SettingsView from './components/SettingsView';

const VIEWS = {
  months: MonthsView,
  summary: SummaryView,
  contracts: ContractsView,
  settings: SettingsView,
};
const TABS = [
  { key: 'months', label: 'Monat' },
  { key: 'summary', label: 'Auswertung' },
  { key: 'contracts', label: 'Verträge' },
  { key: 'settings', label: 'Einstellungen' },
];
const DEFAULT_VIEW = 'months';

// Das Finanzen-Modul in seiner Gesamtheit — genau der Inhalt, der vorher
// die komplette App war. view/onNavigateView kommen von App.jsx (URL-
// Routing, core/lib/useRoute.js) — kein eigener useState mehr, dadurch
// übersteht die aktuelle Unteransicht einen Reload automatisch und hat
// einen eigenen Link (#/finance/summary usw.), siehe Projektkontext.md.
//
// Die Bottom-Nav (core/components/ModuleBottomNav.jsx) ist seit
// BOTTOMNAV_6MODULE.md global/modulübergreifend — die Unteransichten
// dieses Moduls (Monat/Auswertung/Verträge/Einstellungen) laufen daher
// über ModuleTabs oben im Content statt über eine modul-eigene Leiste.
export default function FinanceModule({ view, onNavigateView }) {
  const activeView = VIEWS[view] ? view : DEFAULT_VIEW;
  const View = VIEWS[activeView];
  return (
    <>
      <ModuleTabs items={TABS} active={activeView} onChange={onNavigateView} />
      <View />
    </>
  );
}
