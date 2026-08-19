import { createContext, useCallback, useContext, useState } from 'react';

// Steuert das globale Erfassen-Sheet (siehe core/components/EntrySheet.jsx).
// Der FAB in der Bottom-Nav jedes Moduls (core/components/ModuleBottomNav.jsx)
// ruft open(moduleId) auf — das Sheet entscheidet selbst, welchen Inhalt es
// für dieses Modul zeigt. "version" wird nach jedem erfolgreichen Speichern
// hochgezählt, damit offene Views (z.B. MonthsView) bei Bedarf neu laden
// können, ohne dass das Sheet die Views direkt kennen muss.
const EntrySheetContext = createContext(null);

export function EntrySheetProvider({ children }) {
  const [openFor, setOpenFor] = useState(null);
  const [version, setVersion] = useState(0);

  const open = useCallback((moduleId) => setOpenFor(moduleId), []);
  const close = useCallback(() => setOpenFor(null), []);
  const notifySaved = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <EntrySheetContext.Provider value={{ openFor, open, close, version, notifySaved }}>
      {children}
    </EntrySheetContext.Provider>
  );
}

export function useEntrySheet() {
  return useContext(EntrySheetContext);
}
