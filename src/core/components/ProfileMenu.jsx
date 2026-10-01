// Dropdown am Profil-Avatar (ModuleTopBar). Jeder Punkt führt in einen
// eigenen Bereich der Profilseite (#/profile/<key>), siehe core/Profile.jsx.
export const PROFILE_SECTIONS = [
  { key: 'konto', label: 'Konto' },
  { key: 'koerperdaten', label: 'Körperdaten' },
  { key: 'aktivitaet', label: 'Aktivität & Ziel' },
  { key: 'ernaehrung', label: 'Ernährungsform' },
  { key: 'ergebnis', label: 'Dein Ergebnis' },
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
            {hasWarnings && (s.key === 'koerperdaten' || s.key === 'aktivitaet') && (
              <span className="warn-dot-inline" aria-label="Angaben fehlen" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
