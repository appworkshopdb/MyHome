// core/components/PageSection.jsx
// Sektions-Wrapper mit Kopfzeile — auf Detail-Screens weiterhin genutzt
// (siehe UMBAU-PLAN.md Schritt 4: "Regel: ein Detail-Screen = ein Bereich",
// Detail-Screens rendern bestehende Views in genau so einer Sektion).
// Nutzt jetzt SectionHead.jsx für die Kopfzeile statt eigenes Markup, damit
// Detail-Screens und Modul-Übersichten optisch identisch aussehen.
//
// action: optional { label, onPress } für einen Ausstieg rechts im Kopf
// (selten auf Detail-Screens gebraucht, aber möglich — z. B. ein
// Filter-Reset o. Ä.). Ohne action bleibt die Kopfzeile wie bisher: nur Titel.
import SectionHead from './SectionHead.jsx';

export default function PageSection({ title, action, children }) {
  return (
    <section className="page-section">
      <SectionHead title={title} label={action?.label} onPress={action?.onPress} />
      {children}
    </section>
  );
}
