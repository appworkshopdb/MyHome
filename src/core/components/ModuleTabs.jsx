// Horizontale Tab-Leiste OBEN im Modul, für die Unteransichten
// innerhalb eines Moduls (z.B. Finanzen: Monat/Auswertung/Verträge/
// Einstellungen). Wurde nötig, weil die globale Bottom-Nav jetzt
// modulübergreifend ist (core/components/ModuleBottomNav.jsx, siehe
// BOTTOMNAV_6MODULE.md) und keine In-Modul-Unteransichten mehr trägt.
// Rein visuell — Routing/aktive Ansicht kommt weiterhin aus
// core/lib/useRoute.js über die jeweilige <XyzModule/>-Komponente.
export default function ModuleTabs({ items, active, onChange }) {
  return (
    <div className="module-tabs">
      {items.map(({ key, label }) => (
        <button
          key={key}
          className={module-tab ${active === key ? 'active' : ''}}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
