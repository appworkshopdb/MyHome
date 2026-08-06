import Modal from '../../../core/components/Modal';
import { IconEdit, IconTrash } from '../../../core/components/Icons';
import { basis, fmt, TAG_COLORS } from '../lib/nutrition';

const MACRO_ROWS = [
  ['kcal', 'kcal', 0],
  ['protein', 'Protein (g)', 1],
  ['carbs', 'KH (g)', 1],
  ['sugar', 'Zucker (g)', 1],
  ['fat', 'Fett (g)', 1],
  ['satfat', 'ges. Fettsäuren (g)', 1],
  ['fiber', 'Ballaststoffe (g)', 1],
  ['salt', 'Salz (g)', 2],
];

export default function FoodDetailModal({ food, onEdit, onDelete, onCompare, compareCount, inCompare, onClose }) {
  const micros = [...(food.vitamins || []), ...(food.minerals || []), ...(food.micros_other || [])];

  return (
    <Modal title={food.name} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => onEdit(food)}><IconEdit /> Bearbeiten</button>
        {food._rowId && (
          <button className="btn btn-danger" onClick={() => onDelete(food)}><IconTrash /> Löschen</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className={`ampel-badge ${food.category}`}>
          {food.category === 'erlaubt' ? 'Erlaubt' : food.category === 'okay' ? 'OKAY' : 'Tabu'}
        </span>
        <span className="chip">{food.group}</span>
        <span className="chip">{basis(food.unit)}</span>
        {food.glutenfrei && <span className="ampel-badge erlaubt">Glutenfrei</span>}
        {food.laktosefrei && <span className="ampel-badge erlaubt">Laktosefrei</span>}
      </div>

      <div className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <div className="card-title" style={{ padding: '10px 14px', marginBottom: 0, background: 'var(--bg-input)' }}>
          Nährwerte pro {basis(food.unit)}
        </div>
        {MACRO_ROWS.map(([key, label, digits]) => (
          <div key={key} style={{ display: 'flex', padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmt(food[key], digits)}</span>
          </div>
        ))}
      </div>

      {micros.length > 0 && (
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>Vitamine &amp; Mineralstoffe</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {micros.map((m) => <span key={m} className="tag-chip" style={{ background: 'var(--accent-dark)', color: 'var(--on-accent)' }}>{m}</span>)}
          </div>
        </div>
      )}

      {(food.allergens || []).length > 0 && (
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>Allergene</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {food.allergens.map((a) => <span key={a} className="tag-chip" style={{ background: 'var(--danger)' }}>{a}</span>)}
          </div>
        </div>
      )}

      {(food.tags || []).length > 0 && (
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {food.tags.map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
          </div>
        </div>
      )}

      <button
        className="btn btn-secondary btn-block"
        disabled={compareCount >= 4 && !inCompare}
        onClick={onCompare}
      >
        {inCompare ? 'Im Vergleich' : 'Zum Vergleich hinzufügen'}
      </button>
    </Modal>
  );
}
