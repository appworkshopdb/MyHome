import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import HabitQuickSheet    from './HabitQuickSheet';
import SportQuickSheet    from './SportQuickSheet';
import ShoppingQuickSheet from './ShoppingQuickSheet';
import NutritionFabMenu   from './NutritionFabMenu';
import TodoSheet          from './TodoSheet';
import SparschweinFab     from './SparschweinFab';

// Globaler FAB — rendert sich je nach aktivem Modul anders.
// Erscheint auf allen Screens außer Profil.
// module: null = Hub, 'habits', 'finance', 'sport', 'nutrition', 'shopping'
//
// Ernährung hat zwei Anlege-Wege (Rezept/Lebensmittel) — dafür öffnet
// der FAB eine kleine Moduswahl (NutritionFabMenu.jsx), die per
// window-Event mit dem Modul kommuniziert statt es direkt zu
// importieren (core/ darf nicht aus modules/ importieren). Vorher
// hatten RezepteView/AmpelView je einen eigenen FAB — das ging nur gut,
// solange nur einer der beiden Tabs gleichzeitig sichtbar war.
export default function GlobalFab({ activeModule, onTodoSaved }) {
  const { open: openEntrySheet } = useEntrySheet(); // Finanzen nutzt den bestehenden EntrySheet
  const [open, setOpen] = useState(null); // null | 'todo' | 'habit' | 'sport' | 'shopping' | 'nutrition'

  // Kein FAB auf Profil
  if (activeModule === 'profile') return null;

  function handlePress() {
    if (activeModule === null)       return setOpen('todo');
    if (activeModule === 'habits')   return setOpen('habit');
    if (activeModule === 'finance')  return openEntrySheet('finance');   // bestehender EntrySheet
    if (activeModule === 'sport')    return setOpen('sport');
    if (activeModule === 'nutrition') return setOpen('nutrition');
    if (activeModule === 'shopping') return setOpen('shopping');
  }

  return (
    <>
      {activeModule === 'finance' && <SparschweinFab />}

      <button
        className="global-fab"
        onClick={handlePress}
        aria-label="Neuen Eintrag erstellen"
      >
        <span className="global-fab-plus">+</span>
      </button>

      {open === 'todo' && (
        <TodoSheet
          onClose={() => setOpen(null)}
          onSaved={(t) => { onTodoSaved?.(t); setOpen(null); }}
        />
      )}
      {open === 'habit' && (
        <HabitQuickSheet
          onClose={() => setOpen(null)}
          onSaved={() => setOpen(null)}
        />
      )}
      {open === 'sport' && (
        <SportQuickSheet
          onClose={() => setOpen(null)}
          onSaved={() => setOpen(null)}
        />
      )}
      {open === 'nutrition' && (
        <NutritionFabMenu onClose={() => setOpen(null)} />
      )}
      {open === 'shopping' && (
        <ShoppingQuickSheet
          onClose={() => setOpen(null)}
          onSaved={() => setOpen(null)}
        />
      )}
    </>
  );
}
