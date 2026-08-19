import { IconMonth, IconSummary, IconContracts, IconSettings } from '../../../core/components/Icons';
import ModuleBottomNav from '../../../core/components/ModuleBottomNav';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';

// Menüpunkte für dieses Modul — die Leisten-Hülle selbst kommt aus
// core/components/ModuleBottomNav.jsx (siehe Projektkontext.md,
// Abschnitt "Modul-Leiste").
const ITEMS = [
  { key: 'months', label: 'Monat', Icon: IconMonth },
  { key: 'summary', label: 'Auswertung', Icon: IconSummary },
  { key: 'contracts', label: 'Verträge', Icon: IconContracts },
  { key: 'settings', label: 'Einstellungen', Icon: IconSettings },
];

export default function BottomNav({ active, onChange }) {
  const { open } = useEntrySheet();
  return <ModuleBottomNav items={ITEMS} active={active} onChange={onChange} onAdd={() => open('finance')} />;
}
