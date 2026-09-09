// core/components/FocusCard.jsx
// Die dunkle Fokuskarte, die auf jeder Modul-Hauptansicht ganz oben steht
// (Saldo, Heute-Training, aktive Liste, Ampel-Frage, Gewohnheiten-Ring …).
// Sechs sehr unterschiedliche Inhalte im Mockup — deshalb bewusst KEIN
// starres Props-Schema, sondern ein Baukasten aus Unterkomponenten, die
// jede Modul-Übersicht (Schritt 5–9) frei zusammensetzt. Für Layouts, die
// gar nicht in dieses Raster passen (Gewohnheiten-Ring, Ernährungs-
// Suchfeld), einfach eigenes Markup als children reinreichen — FocusCard
// selbst liefert nur die Kartenhülle (Fläche, Radius, Schatten, Textfarben).
//
// Beispiel (Hub-Saldo):
//   <FocusCard>
//     <FocusCard.Eyebrow>Saldo September</FocusCard.Eyebrow>
//     <FocusCard.Value>+ 842,10 €</FocusCard.Value>
//     <FocusCard.Meta>Ein <b>3.180 €</b>  Aus <b>2.337,90 €</b></FocusCard.Meta>
//     <FocusCard.Footer>
//       <span>3 offene Posten · 412,80 €</span>
//       <FocusCard.Pill onPress={...}>Ansehen</FocusCard.Pill>
//     </FocusCard.Footer>
//   </FocusCard>
//
// Beispiel (Sport, zwei große Aktionen statt Footer):
//   <FocusCard>
//     ...
//     <FocusCard.ActionRow>
//       <FocusCard.ActionPrimary onPress={...}>Erledigt</FocusCard.ActionPrimary>
//       <FocusCard.ActionSecondary onPress={...}>Ändern</FocusCard.ActionSecondary>
//     </FocusCard.ActionRow>
//   </FocusCard>

export default function FocusCard({ children, className = '' }) {
  return <div className={`focus-card ${className}`}>{children}</div>;
}

// Kleine Versal-Zeile oben, optional mit Element rechts (Store-Name,
// Status-Chip …)
FocusCard.Eyebrow = function Eyebrow({ children, right }) {
  return (
    <div className="focus-card-eyebrow-row">
      <span className="focus-card-eyebrow">{children}</span>
      {right && <span className="focus-card-eyebrow-right">{right}</span>}
    </div>
  );
};

// Der große Wert — Text oder Zahl, 36–38px/800
FocusCard.Value = function Value({ children }) {
  return <div className="focus-card-value">{children}</div>;
};

// Sekundärzeile darunter, 13px
FocusCard.Meta = function Meta({ children }) {
  return <div className="focus-card-meta">{children}</div>;
};

// 8px-Fortschrittsbalken, value als 0–1
FocusCard.Progress = function Progress({ value = 0 }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="focus-card-progress">
      <div className="focus-card-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

// Fußzeile mit Trennlinie (divider=false lässt sie weg, z. B. Einkauf-Karte
// ohne Linie zwischen Balken und "8 von 14 erledigt")
FocusCard.Footer = function Footer({ children, divider = true }) {
  return (
    <div className={`focus-card-footer ${divider ? 'focus-card-footer--divider' : ''}`}>
      {children}
    </div>
  );
};

// Kleine weiße Pille, meist in der Footer-Zeile ("Ansehen", "Öffnen")
FocusCard.Pill = function Pill({ children, onPress }) {
  return (
    <button className="focus-card-pill" onClick={onPress}>
      {children}
    </button>
  );
};

// Zeile für ein bis zwei große Aktionen (Sport: "Erledigt" + "Ändern")
FocusCard.ActionRow = function ActionRow({ children }) {
  return <div className="focus-card-action-row">{children}</div>;
};

FocusCard.ActionPrimary = function ActionPrimary({ children, onPress }) {
  return (
    <button className="focus-card-action focus-card-action--primary" onClick={onPress}>
      {children}
    </button>
  );
};

FocusCard.ActionSecondary = function ActionSecondary({ children, onPress }) {
  return (
    <button className="focus-card-action focus-card-action--secondary" onClick={onPress}>
      {children}
    </button>
  );
};
