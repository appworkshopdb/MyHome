// src/modules/finance/lib/FinanceMonthContext.js
//
// Teilt den aktuell in MonthsView angezeigten Monat mit dem EntrySheet
// (globaler "+") — ohne Prop-Drilling durch GlobalFab/FinanceModule.
// MonthsView schreibt bei jedem Monatswechsel rein,
// EntrySheet liest beim Anlegen raus.
// Solange MonthsView nicht gemountet ist (Übersicht, andere Screens)
// bleibt der Wert auf dem echten aktuellen Monat.
//
// Kein JSX — bleibt .js-kompatibel (createElement statt JSX-Syntax).

import { createContext, createElement, useContext, useState } from 'react';

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

  return createElement(
    FinanceMonthContext.Provider,
    { value: { activeYear, activeMonth, setActiveMonth } },
    children
  );
}

export function useFinanceMonth() {
  return useContext(FinanceMonthContext);
}
