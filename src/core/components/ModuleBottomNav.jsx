// Die feste "leere" Leiste, die jedes Modul bekommt. Layout/Optik kommt
// komplett aus den globalen .bottom-nav/.nav-item-Klassen (siehe
// styles/layout.css) — ein Modul entscheidet nur noch, welche
// Menüpunkte (items) es bekommt, siehe z.B.
// modules/finance/components/BottomNav.jsx als Vorlage für neue Module.
// Die feste Leiste, die jedes Modul bekommt: 2 Menüpunkte, ein
// zentraler "+"-FAB (global, modulabhängig vorbelegt via onAdd), dann
// 2 weitere Menüpunkte. Layout/Optik kommt komplett aus den globalen
// .bottom-nav/.nav-item/.nav-fab-Klassen (siehe styles/layout.css) —
// ein Modul entscheidet nur, welche 4 Menüpunkte (items) und was der
// FAB tun soll (onAdd), siehe z.B.
// modules/finance/components/BottomNav.jsx als Vorlage für neue Module.
export default function ModuleBottomNav({ items, active, onChange, onAdd }) {
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);

  return (
    <nav className="bottom-nav">
      {left.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`nav-item ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}

      <button className="nav-fab" onClick={onAdd} aria-label="Neuer Eintrag">
        +
      </button>

      {right.map(({ key, label, Icon }) => (
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
