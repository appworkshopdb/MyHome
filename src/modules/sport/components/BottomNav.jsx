import { IconDumbbell, IconCalendarSmall, IconBulb, IconSummary } from '../../../core/components/Icons';
import ModuleBottomNav from '../../../core/components/ModuleBottomNav';

// Menüpunkte für dieses Modul — die Leisten-Hülle selbst kommt aus
// core/components/ModuleBottomNav.jsx (siehe Projektkontext.md,
// Abschnitt "Modul-Leiste"), genau wie bei
// modules/finance/components/BottomNav.jsx.
const ITEMS = [
  { key: 'training', label: 'Training', Icon: IconDumbbell },
  { key: 'verlauf', label: 'Verlauf', Icon: IconCalendarSmall },
  { key: 'plaene', label: 'Pläne', Icon: IconBulb },
  { key: 'auswertung', label: 'Auswertung', Icon: IconSummary },
];

export default function BottomNav({ active, onChange }) {
  return <ModuleBottomNav items={ITEMS} active={active} onChange={onChange} />;
}
