// core/components/AreaList.jsx
// Die helle Karte, die eine Liste von AreaRow-Zeilen umschließt (die
// "Bereiche"-Sektion jeder Modul-Übersicht). Trennlinien statt Abstände
// zwischen den Zeilen, siehe area-row-CSS.
//
// Alle Zeilen haben dasselbe rechte Padding, damit die Pfeile bündig in einer
// Spalte stehen. Der schwebende "+" wird NICHT über Zeilen-Padding umgangen
// (das hat den Pfeil der letzten Zeile eingerückt), sondern über den
// Scroll-Abstand unten (.main-content.module-active in layout.css).
//
// variant: 'list' (Standard, eine Karte mit Trennlinien) | 'tiles' (zwei
// Spalten Kacheln; eine einzelne letzte Kachel läuft über beide Spalten)
export default function AreaList({ children, variant = 'list' }) {
  return <div className={`area-list${variant === 'tiles' ? ' area-list--tiles' : ''}`}>{children}</div>;
}
