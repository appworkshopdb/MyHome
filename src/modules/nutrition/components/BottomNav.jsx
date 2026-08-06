import { IconList, IconUtensils, IconBook, IconBulb, IconUserRound } from '../../../core/components/Icons';

const ITEMS = [
  { key: 'ampel', label: 'Ampel', Icon: IconList },
  { key: 'rezepte', label: 'Rezepte', Icon: IconUtensils },
  { key: 'lexikon', label: 'Lexikon', Icon: IconBook },
  { key: 'tipps', label: 'Tipps', Icon: IconBulb },
  { key: 'profil', label: 'Profil', Icon: IconUserRound },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ key, label, Icon }) => (
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
