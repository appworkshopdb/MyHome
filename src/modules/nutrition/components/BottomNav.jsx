import { IconList, IconUtensils, IconBook, IconBulb, IconUserRound } from '../../../core/components/Icons';
import ModuleBottomNav from '../../../core/components/ModuleBottomNav';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';

// Menüpunkte für dieses Modul — die Leisten-Hülle selbst kommt aus
// core/components/ModuleBottomNav.jsx (siehe Projektkontext.md,
// Abschnitt "Modul-Leiste").
const ITEMS = [
  { key: 'ampel', label: 'Ampel', Icon: IconList },
  { key: 'rezepte', label: 'Rezepte', Icon: IconUtensils },
  { key: 'lexikon', label: 'Lexikon', Icon: IconBook },
  { key: 'tipps', label: 'Tipps', Icon: IconBulb },
  { key: 'profil', label: 'Profil', Icon: IconUserRound },
];

export default function BottomNav({ active, onChange }) {
  const { open } = useEntrySheet();
  return <ModuleBottomNav items={ITEMS} active={active} onChange={onChange} onAdd={() => open('nutrition')} />;
}
