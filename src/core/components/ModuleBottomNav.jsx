// Die feste "leere" Leiste, die jedes Modul bekommt. Layout/Optik kommt
// komplett aus den globalen .bottom-nav/.nav-item-Klassen (siehe
// styles/layout.css) — ein Modul entscheidet nur noch, welche
// Menüpunkte (items) es bekommt, siehe z.B.
// modules/finance/components/BottomNav.jsx als Vorlage für neue Module.
export default function ModuleBottomNav({ items, active, onChange }) {
  return (
    <nav className="bottom-nav">
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`nav-item ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
