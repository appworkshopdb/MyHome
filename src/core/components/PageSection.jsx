// core/components/PageSection.jsx
// Ersetzt die frühere Tab-Leiste (ModuleTabs) innerhalb eines Moduls: statt
// mehrerer Unteransichten, zwischen denen man tippen muss, liegt der
// gesamte Modulinhalt jetzt auf einer durchlaufenden Seite. Jeder frühere
// Tab-Inhalt wird zu einem PageSection-Block mit eigener Überschrift.
//
// Optik identisch zu Hub.jsx' .hub-section-label (Unterstrich, Versalien,
// 24px Abstand nach oben) — dadurch sehen Hub und Module konsistent aus.
export default function PageSection({ title, children }) {
  return (
    <section className="page-section">
      <h2 className="page-section-title">{title}</h2>
      {children}
    </section>
  );
}
