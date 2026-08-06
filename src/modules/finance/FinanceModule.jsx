import { useState } from 'react';
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

// Das Finanzen-Modul in seiner Gesamtheit — genau der Inhalt, der vorher
// die komplette App war. Jetzt ist es ein austauschbarer Baustein neben
// den anderen (noch ungebauten) Modulen in der App-Hülle.
export default function FinanceModule() {
  const [view, setView] = useState('months');
  const View = VIEWS[view];
  return (
    <>
      <View />
      <BottomNav active={view} onChange={setView} />
    </>
  );
}
