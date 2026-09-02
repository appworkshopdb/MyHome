import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import HabitQuickSheet    from './HabitQuickSheet';
import SportQuickSheet    from './SportQuickSheet';
import ShoppingQuickSheet from './ShoppingQuickSheet';
import TodoSheet          from './TodoSheet';

// Globaler FAB — rendert sich je nach aktivem Modul anders.
// Erscheint auf allen Screens außer Profil.
// module: null = Hub, 'habits', 'finance', 'sport', 'nutrition', 'shopping'
export default function GlobalFab({ activeModule, onTodoSaved }) {
  const { open: openEntrySheet } = useEntrySheet(); // Finanzen nutzt den bestehenden EntrySheet
  const [open, setOpen] = useState(null); // null | 'todo' | 'habit' | 'sport' | 'shopping'

  // Kein FAB auf Profil
  if (activeModule === 'profile') return null;

  function handlePress() {
    if (activeModule === null)       return setOpen('todo');
    if (activeModule === 'habits')   return setOpen('habit');
    if (activeModule === 'finance')  return openEntrySheet('finance');   // bestehender EntrySheet
    if (activeModule === 'sport')    return setOpen('sport');
    if (activeModule === 'nutrition') return null;         // später
    if (activeModule === 'shopping') return setOpen('shopping');
  }

  // Ernährung bekommt einen deaktivierten FAB mit Hinweis
  const isDisabled = activeModule === 'nutrition';

  return (
    <>
      <button
        className={`global-fab ${isDisabled ? 'global-fab--disabled' : ''}`}
        onClick={handlePress}
        aria-label="Neuen Eintrag erstellen"
        title={isDisabled ? 'Funktion kommt bald' : undefined}
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
