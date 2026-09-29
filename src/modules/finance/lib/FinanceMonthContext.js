// src/modules/finance/lib/FinanceMonthContext.js
//
// Teilt den aktuell in MonthsView angezeigten Monat mit dem
// SparschweinFab — ohne Prop-Drilling durch GlobalFab/FinanceModule.
// MonthsView schreibt bei jedem Monatswechsel rein,
// SparschweinFab liest beim Einzahlen raus.
// Solange MonthsView nicht gemountet ist (Übersicht, andere Screens)
// bleibt der Wert auf dem echten aktuellen Monat.

import { createContext, useContext, useState } from 'react';

const now = new Date();

const FinanceMonthContext = createContext({
  activeYear:  now.getFullYear(),
  activeMonth: now.getMonth() + 1,
  setActiveMonth: () => {},
});

export function FinanceMonthProvider({ children }) {
  const n = new Date();
  const [activeYear,  setActiveYear]  = useState(n.getFullYear());
  const [activeMonth, setActiveMonth_] = useState(n.getMonth() + 1);

  function setActiveMonth(year, month) {
    setActiveYear(year);
    setActiveMonth_(month);
  }

  return (
    <FinanceMonthContext.Provider value={{ activeYear, activeMonth, setActiveMonth }}>
      {children}
    </FinanceMonthContext.Provider>
  );
}

export function useFinanceMonth() {
  return useContext(FinanceMonthContext);
}
