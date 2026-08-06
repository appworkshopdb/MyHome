import Modal from '../../../core/components/Modal';
import { IconEdit, IconTrash, IconPlus } from '../../../core/components/Icons';
import { RECIPE_CATS, TAG_COLORS, fmt } from '../lib/nutrition';

const UNIT_LABEL = { ml: 'ml', Scheibe: 'Sch.', Stück: 'Stk.', Zehe: 'Zehe', EL: 'EL' };

export default function RecipeDetailModal({ recipe, calc, foodsById, isTemplate, onEdit, onDelete, onCopy, onClose }) {
  const servings = recipe.servings || 1;
  const perServing = Math.round(calc.kcal / servings);
  const cat = RECIPE_CATS.find((c) => c.key === recipe.category) || RECIPE_CATS[0];

  return (
    <Modal title={recipe.name} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8 }}>
        {isTemplate ? (
          <button className="btn btn-primary" onClick={() => onCopy(recipe)}><IconPlus /> Übernehmen</button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => onEdit(recipe)}><IconEdit /> Bearbeiten</button>
            <button className="btn btn-danger" onClick={() => onDelete(recipe.id)}><IconTrash /> Löschen</button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="chip">{cat.emoji} {cat.label}</span>
        <span className="chip">{servings} Portion{servings !== 1 ? 'en' : ''}</span>
      </div>

      <div className="result-grid">
        <div className="result-tile"><div className="label">Kalorien gesamt</div><div className="value">{Math.round(calc.kcal)}<span>kcal</span></div></div>
        <div className="result-tile"><div className="label">Pro Portion</div><div className="value">{perServing}<span>kcal</span></div></div>
        <div className="result-tile"><div className="label">Protein</div><div className="value">{fmt(calc.protein)}<span>g</span></div></div>
        <div className="result-tile"><div className="label">Kohlenhydrate</div><div className="value">{fmt(calc.carbs)}<span>g</span></div></div>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>Zutaten</div>
        <div className="card" style={{ margin: 0, padding: 0 }}>
          {recipe.ingredients.map((ing, idx) => {
            const food = foodsById[ing.foodId];
            if (!food) return null;
            return (
              <div key={idx} style={{ display: 'flex', padding: '9px 14px', borderBottom: idx < recipe.ingredients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ flex: 1, fontSize: '0.85rem' }}>{food.name}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ing.amount} {UNIT_LABEL[food.unit] || 'g'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {((recipe.goalTags || []).length > 0 || (recipe.customTags || []).length > 0 || calc.tags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(recipe.goalTags || []).map((t) => <span key={t} className="goal-tag">{t}</span>)}
          {(recipe.customTags || []).map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
          {calc.tags.map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
        </div>
      )}

      {recipe.note && (
        <div className="lex-detail-block" style={{ background: 'var(--warning-light)' }}>
          <div className="heading" style={{ color: 'var(--warning)' }}>Notiz</div>
          <div style={{ fontSize: '0.85rem' }}>{recipe.note}</div>
        </div>
      )}
    </Modal>
  );
}
