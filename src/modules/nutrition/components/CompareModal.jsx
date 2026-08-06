import Modal from '../../../core/components/Modal';
import { fmt } from '../lib/nutrition';

const ROWS = [
  ['kcal', 'kcal', 0],
  ['protein', 'Protein (g)', 1],
  ['carbs', 'KH (g)', 1],
  ['sugar', 'Zucker (g)', 1],
  ['fat', 'Fett (g)', 1],
  ['fiber', 'Ballaststoffe (g)', 1],
];

export default function CompareModal({ items, onRemove, onClose }) {
  return (
    <Modal title="Vergleich" onClose={onClose}>
      {items.length === 0 ? (
        <div className="empty-state">Noch keine Lebensmittel zum Vergleich ausgewählt.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                {items.map((f) => (
                  <th key={f.id}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.name}</div>
                    <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => onRemove(f.id)}>entfernen</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([key, label, digits]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {items.map((f) => <td key={f.id}>{fmt(f[key], digits)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
