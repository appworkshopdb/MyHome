import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Steuert das globale Erfassen-Sheet (siehe core/components/EntrySheet.jsx).
// Finance-Views können den aktuell angezeigten Buchungsmonat hinterlegen.
const EntrySheetContext = createContext(null);

export function EntrySheetProvider({ children }) {
  const [openFor, setOpenFor] = useState(null);
  const [version, setVersion] = useState(0);
  const [financePeriod, setFinancePeriodState] = useState(null);
  const financePeriodRef = useRef(null);

  const open = useCallback((moduleId) => setOpenFor(moduleId), []);
  const close = useCallback(() => setOpenFor(null), []);
  const notifySaved = useCallback(() => setVersion((v) => v + 1), []);

  // State + Ref gemeinsam pflegen. Die Ref hält den zuletzt ausgewählten
  // Buchungsmonat synchron für das globale Erfassen-Sheet vor.
  const setFinancePeriod = useCallback((year, month) => {
    const period = { year, month };
    financePeriodRef.current = period;
    setFinancePeriodState(period);
  }, []);

  const getFinancePeriod = useCallback(() => financePeriodRef.current, []);

  return (
    <EntrySheetContext.Provider
      value={{
        openFor,
        open,
        close,
        version,
        notifySaved,
        financePeriod,
        setFinancePeriod,
        getFinancePeriod,
      }}
    >
      {children}
    </EntrySheetContext.Provider>
  );
}

export function useEntrySheet() {
  return useContext(EntrySheetContext);
}
