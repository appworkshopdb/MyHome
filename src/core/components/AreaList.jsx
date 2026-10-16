// core/components/AreaList.jsx
// Die helle Karte, die eine Liste von AreaRow-Zeilen umschließt (die
// "Bereiche"-Sektion jeder Modul-Übersicht). Trennlinien statt Abstände
// zwischen den Zeilen, siehe area-row-CSS.
//
// Alle Zeilen haben dasselbe rechte Padding, damit die Chevrons bündig in
// einer Spalte stehen. Der schwebende FAB wird NICHT über Zeilen-Padding
// umgangen (das hat die Chevron-Spalte der letzten Zeile eingerückt),
// sondern über den Scroll-Abstand unten (.main-content.has-fab).
export default function AreaList({ children }) {
  return <div className="area-list">{children}</div>;
}
