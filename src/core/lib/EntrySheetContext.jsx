import { createContext, useCallback, useContext, useState } from 'react';

// Steuert das globale Erfassen-Sheet (siehe core/components/EntrySheet.jsx).
// Finance-Views können zusätzlich den aktuell angezeigten Buchungsmonat
// hinterlegen. Der globale + Button übernimmt dann genau diesen Monat,
// statt immer den Systemmonat zu verwenden.
const EntrySheetContext = createContext(null);

export function EntrySheetProvider({ children }) {
  const [openFor, setOpenFor] = useState(null);
  const [version, setVersion] = useState(0);
  const [financePeriod, setFinancePeriodState] = useState(null);

  const open = useCallback((moduleId) => setOpenFor(moduleId), []);
  const close = useCallback(() => setOpenFor(null), []);
  const notifySaved = useCallback(() => setVersion((v) => v + 1), []);
  const setFinancePeriod = useCallback((year, month) => {
    setFinancePeriodState({ year, month });
  }, []);

  return (
    <EntrySheetContext.Provider
      value={{ openFor, open, close, version, notifySaved, financePeriod, setFinancePeriod }}
    >
      {children}
    </EntrySheetContext.Provider>
  );
}

export function useEntrySheet() {
  return useContext(EntrySheetContext);
}
