import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { track } from './analytics';

// Steuert das globale Erfassen-Sheet (siehe core/components/EntrySheet.jsx).
// Finance-Views können den aktuell angezeigten Buchungsmonat hinterlegen.
const EntrySheetContext = createContext(null);

export function EntrySheetProvider({ children }) {
  const [openFor, setOpenFor] = useState(null);
  const [version, setVersion] = useState(0);
  const [financePeriod, setFinancePeriodState] = useState(null);
  const financePeriodRef = useRef(null);
  // Version zusätzlich als Ref: Sheets rufen notifySaved() und gleich danach
  // onClose(). Wer beim Schließen wissen will, ob gespeichert wurde
  // (ModuleTutorial), liest über getVersion() synchron den aktuellen Wert statt
  // des noch nicht neu gerenderten State.
  const versionRef = useRef(0);

  const open = useCallback((moduleId) => {
    track('sheet_open', { target: String(moduleId) });
    setOpenFor(moduleId);
  }, []);
  const close = useCallback(() => setOpenFor(null), []);
  const notifySaved = useCallback(() => {
    versionRef.current += 1;
    setVersion(versionRef.current);
  }, []);
  const getVersion = useCallback(() => versionRef.current, []);

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
        getVersion,
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
