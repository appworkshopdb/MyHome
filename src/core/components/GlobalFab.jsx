import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import HabitQuickSheet    from './HabitQuickSheet';
import SportQuickSheet    from './SportQuickSheet';
import ShoppingQuickSheet from './ShoppingQuickSheet';
import TodoSheet          from './TodoSheet';

// Globaler FAB — rendert sich je nach aktivem Modul anders.
// Erscheint auf allen Screens außer Profil UND Ernährung.
// module: null = Hub, 'habits', 'finance', 'sport', 'nutrition', 'shopping'
//
// Ernährung hat KEINEN globalen FAB (mehr): "Neu anlegen" bedeutet dort
// je nach Unter-Tab etwas anderes (Ampel -> Lebensmittel, Rezepte ->
// Rezept, Lexikon/Tipps/Profil -> gar nichts) — das kann ein modul-
// unabhängiger FAB nicht sinnvoll entscheiden, da er den aktiven
// Unter-Tab nicht kennt. Das Modul rendert stattdessen seinen eigenen
// kontextabhängigen Fab direkt in AmpelView.jsx/RezepteView.jsx.
export default function GlobalFab({ activeModule, onTodoSaved }) {
  const { open: openEntrySheet } = useEntrySheet(); // Finanzen nutzt den bestehenden EntrySheet
  const [open, setOpen] = useState(null); // null | 'todo' | 'habit' | 'sport' | 'shopping'

  // Kein FAB auf Profil oder Ernährung
  if (activeModule === 'profile' || activeModule === 'nutrition') return null;

  function handlePress() {
    if (activeModule === null)       return setOpen('todo');
    if (activeModule === 'habits')   return setOpen('habit');
    if (activeModule === 'finance')  return openEntrySheet('finance');   // bestehender EntrySheet
    if (activeModule === 'sport')    return setOpen('sport');
    if (activeModule === 'shopping') return setOpen('shopping');
  }

  return (
    <>
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
      {open === 'shopping' && (
        <ShoppingQuickSheet
          onClose={() => setOpen(null)}
          onSaved={() => setOpen(null)}
        />
      )}
    </>
  );
}
