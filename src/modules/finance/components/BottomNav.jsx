import { IconMonth, IconSummary, IconContracts, IconSettings } from '../../../core/components/Icons';
import ModuleBottomNav from '../../../core/components/ModuleBottomNav';

// Menüpunkte für dieses Modul — die Leisten-Hülle selbst kommt aus
// core/components/ModuleBottomNav.jsx (siehe Projektkontext.md,
// Abschnitt "Modul-Leiste").
//
// "contracts" → "Regelmäßig": Oberbegriff für Verträge, Abos,
// Einnahmequellen — alles was regelmäßig/dauerhaft anfällt.
const ITEMS = [
  { key: 'months',    label: 'Monat',       Icon: IconMonth },
  { key: 'summary',  label: 'Auswertung',  Icon: IconSummary },
  { key: 'contracts', label: 'Regelmäßig', Icon: IconContracts },
  { key: 'settings', label: 'Einstellungen', Icon: IconSettings },
];

export default function BottomNav({ active, onChange }) {
  return <ModuleBottomNav items={ITEMS} active={active} onChange={onChange} />;
}
