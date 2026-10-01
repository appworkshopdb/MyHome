// Dropdown am Profil-Avatar (ModuleTopBar). Jeder Punkt führt in einen
// eigenen Bereich der Profilseite (#/profile/<key>), siehe core/Profile.jsx.
export const PROFILE_SECTIONS = [
  { key: 'profil', label: 'Profil' },             // Konto + Körperdaten
  { key: 'ziele', label: 'Ziele & Ernährung' },   // Aktivität & Ziel + Ernährungsform
  { key: 'werte', label: 'Deine Werte' },         // berechnetes Ergebnis (BMI, Kalorien …)
];

export default function ProfileMenu({ active, hasWarnings, onSelect, onClose }) {
  return (
    <>
      <div className="app-menu-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="profile-menu" role="menu">
        {PROFILE_SECTIONS.map((s) => (
          <button
            key={s.key}
            role="menuitem"
            className={`profile-menu-item${active === s.key ? ' active' : ''}`}
            onClick={() => onSelect(s.key)}
          >
            {s.label}
            {hasWarnings && (s.key === 'profil' || s.key === 'ziele') && (
              <span className="warn-dot-inline" aria-label="Angaben fehlen" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
