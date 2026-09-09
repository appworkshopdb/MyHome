// core/components/SectionHead.jsx
// Kopfzeile einer Sektion: Titel links, optionaler Ausstieg rechts
// ("Details ›", "Alle 8 ›", "Kalender ›" — Text + Chevron in einem String).
// Ersetzt die Kopfzeile, die vorher fest in PageSection.jsx stand — wird
// jetzt auch direkt in den neuen Modul-Übersichten verwendet (Fokuskarte +
// helle Karten + Bereiche, siehe UMBAU-PLAN.md Schritt 5–9).
//
// label: z. B. "Details ›" — der Chevron ist Teil des Textes, kein
// eigenes Icon, damit die Breite sich dem Text anpasst.
export default function SectionHead({ title, label, onPress }) {
  return (
    <div className="section-head">
      <h2 className="section-head-title">{title}</h2>
      {label && (
        <button className="section-head-action" onClick={onPress}>
          {label}
        </button>
      )}
    </div>
  );
}
