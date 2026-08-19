import { IconMonth, IconSummary, IconContracts, IconSettings } from '../../../core/components/Icons';
import ModuleBottomNav from '../../../core/components/ModuleBottomNav';

const ITEMS = [
  { key: 'months',   label: 'Monat',          Icon: IconMonth },
  { key: 'summary',  label: 'Auswertung',     Icon: IconSummary },
  { key: 'contracts', label: 'Laufende Posten', Icon: IconContracts },
  { key: 'settings', label: 'Einstellungen',  Icon: IconSettings },
];

export default function BottomNav({ active, onChange }) {
  return <ModuleBottomNav items={ITEMS} active={active} onChange={onChange} />;
}
