// modules/shopping/components/ItemsView.jsx
// Artikelansicht einer Einkaufsliste.
// Platzhalter — wird in Punkt 5 der Prioritätsliste vollständig gebaut.

import { IconBack } from '../../../core/components/Icons.jsx';

export default function ItemsView({ list, onBack }) {
  return (
    <div>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={onBack}
      >
        <span style={{ width: 16, height: 16, display: 'flex' }}><IconBack /></span>
        Zurück zu den Listen
      </button>
      <div className="sho-empty">
        <div className="sho-empty-icon">{list.icon || '🛒'}</div>
        <div className="sho-empty-title">{list.name}</div>
        <div className="sho-empty-text">
          Artikelansicht wird als nächstes gebaut.
        </div>
      </div>
    </div>
  );
}
