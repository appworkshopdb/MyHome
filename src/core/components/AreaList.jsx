// core/components/AreaList.jsx
// Die helle Karte, die eine Liste von AreaRow-Zeilen umschließt (die
// "Bereiche"-Sektion jeder Modul-Übersicht). Trennlinien statt Abstände
// zwischen den Zeilen, siehe area-row-CSS.
//
// fabClearance: true reserviert in der LETZTEN Zeile 76px Platz rechts,
// damit der schwebende FAB (56px, right:18px) keinen Chevron/Text verdeckt.
// Absichtlich als Klasse auf der Liste, nicht als Prop pro Zeile — die
// aufrufende Übersicht muss nicht wissen, welche Zeile zufällig die letzte
// ist.
export default function AreaList({ children, fabClearance = false }) {
  return (
    <div className={`area-list ${fabClearance ? 'area-list--fab-clearance' : ''}`}>
      {children}
    </div>
  );
}
