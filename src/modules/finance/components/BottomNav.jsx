import { IconMonth, IconSummary, IconContracts, IconSettings } from '../../../core/components/Icons';

const ITEMS = [
  { key: 'months', label: 'Monat', Icon: IconMonth },
  { key: 'summary', label: 'Auswertung', Icon: IconSummary },
  { key: 'contracts', label: 'Verträge', Icon: IconContracts },
  { key: 'settings', label: 'Einstellungen', Icon: IconSettings },
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
