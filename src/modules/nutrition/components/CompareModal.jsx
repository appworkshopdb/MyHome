import { Button } from '../../../core/components/ui';
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
        <div className="nut-u-scrollx">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                {items.map((f) => (
                  <th key={f.id}>
                    <div className="nut-cmp-name">{f.name}</div>
                    <Button variant="text" size="s" onClick={() => onRemove(f.id)}>Entfernen</Button>
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
