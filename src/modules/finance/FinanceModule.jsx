import ModuleTopBar from '../../core/components/ModuleTopBar';
import BottomNav from './components/BottomNav';
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
const TITLES = {
  months: 'Monat',
  summary: 'Auswertung',
  contracts: 'Verträge',
  settings: 'Einstellungen',
};
const DEFAULT_VIEW = 'months';

// Das Finanzen-Modul in seiner Gesamtheit — genau der Inhalt, der vorher
// die komplette App war. view/onNavigateView kommen von App.jsx (URL-
// Routing, core/lib/useRoute.js) — kein eigener useState mehr, dadurch
// übersteht die aktuelle Unteransicht einen Reload automatisch und hat
// einen eigenen Link (#/finance/summary usw.), siehe Projektkontext.md.
// ModuleTopBar sitzt hier zentral (nicht in jeder View einzeln) — die
// drei Views mit eigenem page-header (Auswertung/Verträge/Einstellungen)
// haben ihren <h1> deshalb verloren, sonst stünde der Titel doppelt da.
export default function FinanceModule({ view, onNavigateView }) {
  const activeView = VIEWS[view] ? view : DEFAULT_VIEW;
  const View = VIEWS[activeView];
  return (
    <>
      <ModuleTopBar title={TITLES[activeView]} />
      <View />
      <BottomNav active={activeView} onChange={onNavigateView} />
    </>
  );
}
