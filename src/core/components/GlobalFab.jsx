import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { getSheet } from '../lib/sheetRegistry';
import NutritionFabMenu   from './NutritionFabMenu';
import Icon from './Icon';

// Modul → Schlüssel des Sheets, das das Modul in modules/<modul>/sheets.js
// bei der Sheet-Registry anmeldet.
const FAB_SHEETS = {
  habits:   'habits.quick',
  sport:    'sport.quick',
  shopping: 'shopping.quick',
};

// Globaler FAB — rendert sich je nach aktivem Modul anders.
// Erscheint in den Modulen, nicht im Hub (dort legt "Neue Aufgabe" in der Aufgaben-Karte an),
// auf Profil und Statistiken.
// module: 'habits', 'finance', 'sport', 'nutrition', 'shopping'
//
// Ernährung hat zwei Anlege-Wege (Rezept/Lebensmittel) — dafür öffnet
// der FAB eine kleine Moduswahl (NutritionFabMenu.jsx), die per
// window-Event mit dem Modul kommuniziert statt es direkt zu
// importieren (core/ darf nicht aus modules/ importieren). Vorher
// hatten RezepteView/AmpelView je einen eigenen FAB — das ging nur gut,
// solange nur einer der beiden Tabs gleichzeitig sichtbar war.
//
// Die Sheets von Gewohnheiten, Sport und Einkauf liegen in ihren Modulen und
// kommen über die Sheet-Registry (core/lib/sheetRegistry.js).
export default function GlobalFab({ activeModule }) {
  const { open: openEntrySheet } = useEntrySheet(); // Finanzen nutzt den bestehenden EntrySheet
  const [open, setOpen] = useState(null); // null | 'habits' | 'sport' | 'shopping' | 'nutrition'

  // Kein FAB im Hub (activeModule null) sowie auf Profil und Statistiken (reine Anzeigeseiten)
  if (activeModule === null || activeModule === 'profile' || activeModule === 'statistiken') return null;

  function handlePress() {
    if (activeModule === 'finance')  return openEntrySheet('finance');   // bestehender EntrySheet
    if (activeModule === 'nutrition') return setOpen('nutrition');
    if (FAB_SHEETS[activeModule]) return setOpen(activeModule);
  }

  const Sheet = open && FAB_SHEETS[open] ? getSheet(FAB_SHEETS[open]) : null;

  return (
    <>
      <button
        className="global-fab"
        onClick={handlePress}
        aria-label="Neuen Eintrag erstellen"
      >
        <span className="global-fab-plus"><Icon name="plus" size={null} className="glyph" /></span>
      </button>

      {Sheet && (
        <Sheet
          onClose={() => setOpen(null)}
          onSaved={() => setOpen(null)}
        />
      )}
      {open === 'nutrition' && (
        <NutritionFabMenu onClose={() => setOpen(null)} />
      )}
    </>
  );
}
