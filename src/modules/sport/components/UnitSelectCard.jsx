import UnitVisual from './UnitVisual';

// Auswahlfeld für eine Einheit (öffnet die Galerie): leer "Einheit wählen",
// gewählt mit Bildern, Name, Typ und "Ändern". Gemeinsam für den Eintrag einzelner
// Einheiten (FAB-Wizard und Kalender-Formular).
export default function UnitSelectCard({ chosen, title, subtitle, tags, icon, onClick }) {
  return (
    <button type="button" className={`ep-pick${chosen ? ' has' : ''}`} onClick={onClick}>
      {chosen ? (
        <>
          <span className="ep-vis"><UnitVisual tags={tags} icon={icon} size={40} max={3} /></span>
          <span className="ep-tx"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
          <span className="ep-chg">Ändern</span>
        </>
      ) : (
        <>
          <span className="ep-plus" aria-hidden="true">+</span>
          <span className="ep-tx"><b>Einheit wählen</b><small>Kraft, Ausdauer, Beweglichkeit, Sport oder eigene</small></span>
          <span className="ep-chev" aria-hidden="true">›</span>
        </>
      )}
    </button>
  );
}
