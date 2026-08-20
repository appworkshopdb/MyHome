import { useEntrySheet } from '../lib/EntrySheetContext';
import { IconPlus } from './Icons';

// Immer sichtbare Erfassen-Leiste direkt über der Bottom-Nav (siehe
// Design-Anpassungen Zuhause.md, Punkt 5). Ersetzt die frühere
// modul-eigene ".fin-quick-add"-Lösung — ein einziger, verlässlicher
// Einstieg auf jedem Screen statt einer Lösung pro Modul.
// activeModule kommt aus App.jsx (useRoute) und bestimmt nur, WELCHES
// Modul im EntrySheet vorbelegt geöffnet wird — der Text bleibt immer
// "Erfassen", kein modul-spezifischer Zusatztext.
export default function EntryBar({ activeModule }) {
  const { open } = useEntrySheet();
  // Auf dem Hub/Profil noch kein sinnvolles Ziel-Modul — Standard: Finanzen,
  // da aktuell das einzige Modul mit echter Erfassen-Logik im Sheet.
  const target = activeModule && activeModule !== 'profile' ? activeModule : 'finance';

  return (
    <button className="entry-bar" onClick={() => open(target)}>
      <IconPlus />
      <span>Erfassen</span>
    </button>
  );
}
