import Modal from '../../../core/components/Modal';
import { IconEdit, IconTrash } from '../../../core/components/Icons';
import { basis, fmt, TAG_COLORS } from '../lib/nutrition';
import { Button } from '../../../core/components/ui';

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

export default function FoodDetailModal({ food, currentUserId, onEdit, onDelete, onCompare, compareCount, inCompare, onClose }) {
  const micros = [...(food.vitamins || []), ...(food.minerals || []), ...(food.micros_other || [])];

  // Pure Seed-Lebensmittel (noch nie von jemandem angepasst) darf jede:r
  // bearbeiten — das legt automatisch eine eigene Überschreibung an.
  // Ein bereits vorhandener eigener/geteilter Eintrag darf nur vom
  // ursprünglichen Ersteller bearbeitet/gelöscht werden (RLS erlaubt
  // Ändern/Löschen ohnehin nur dem Owner — hier nur passend zur DB
  // ausgeblendet, statt einen Button anzuzeigen, der dann fehlschlägt).
  const isOwner = !food._custom || food.ownerId === currentUserId;
  const isShared = !!food.householdId;
  const canEdit = !food._custom || isOwner;
  const canDelete = food._rowId && isOwner;

  return (
    <Modal title={food.name} onClose={onClose}>
      <div className="nut-u-row">
        {canEdit && (
          <Button variant="secondary" icon="edit" onClick={() => onEdit(food)}>Bearbeiten</Button>
        )}
        {canDelete && (
          <Button variant="danger" icon="trash" onClick={() => onDelete(food)}>Löschen</Button>
        )}
      </div>

      <div className="nut-u-wrap">
        <span className={`ampel-badge ${food.category}`}>
          {food.category === 'erlaubt' ? 'Erlaubt' : food.category === 'okay' ? 'OKAY' : 'Tabu'}
        </span>
        <span className="chip">{food.group}</span>
        <span className="chip">{basis(food.unit)}</span>
        {isShared && <span className="chip">Vom Haushalt geteilt{!isOwner ? ' (nicht von dir)' : ''}</span>}
        {food.glutenfrei && <span className="ampel-badge erlaubt">Glutenfrei</span>}
        {food.laktosefrei && <span className="ampel-badge erlaubt">Laktosefrei</span>}
      </div>

      <div className="card nut-u-flush-hidden">
        <div className="card-title nut-facts-head">
          Nährwerte pro {basis(food.unit)}
        </div>
        {MACRO_ROWS.map(([key, label, digits]) => (
          <div key={key} className="nut-ing-row">
            <span className="nut-u-grow-sec">{label}</span>
            <span className="nut-u-strong">{fmt(food[key], digits)}</span>
          </div>
        ))}
      </div>

      {micros.length > 0 && (
        <div>
          <div className="card-title nut-u-mb8">Vitamine &amp; Mineralstoffe</div>
          <div className="nut-u-wrap">
            {micros.map((m) => <span key={m} className="tag-chip tag-chip--accent">{m}</span>)}
          </div>
        </div>
      )}

      {(food.allergens || []).length > 0 && (
        <div>
          <div className="card-title nut-u-mb8">Allergene</div>
          <div className="nut-u-wrap">
            {food.allergens.map((a) => <span key={a} className="tag-chip nut-u-dangerbg">{a}</span>)}
          </div>
        </div>
      )}

      {(food.tags || []).length > 0 && (
        <div>
          <div className="card-title nut-u-mb8">Tags</div>
          <div className="nut-u-wrap">
            {food.tags.map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
          </div>
        </div>
      )}

      <Button variant="secondary" block
       
        disabled={compareCount >= 4 && !inCompare}
        onClick={onCompare}
      >{inCompare ? 'Im Vergleich' : 'Zum Vergleich hinzufügen'}</Button>
    </Modal>
  );
}
