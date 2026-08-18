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
const DEFAULT_VIEW = 'months';

// Das Finanzen-Modul in seiner Gesamtheit — genau der Inhalt, der vorher
// die komplette App war. view/onNavigateView kommen von App.jsx (URL-
// Routing, core/lib/useRoute.js) — kein eigener useState mehr, dadurch
// übersteht die aktuelle Unteransicht einen Reload automatisch und hat
// einen eigenen Link (#/finance/summary usw.), siehe Projektkontext.md.
export default function FinanceModule({ view, onNavigateView }) {
  const activeView = VIEWS[view] ? view : DEFAULT_VIEW;
  const View = VIEWS[activeView];
  return (
    <>
      <View />
      <BottomNav active={activeView} onChange={onNavigateView} />
    </>
  );
}
