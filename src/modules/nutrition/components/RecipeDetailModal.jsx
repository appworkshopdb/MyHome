import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { IconEdit, IconTrash, IconPlus } from '../../../core/components/Icons';
import { RECIPE_CATS, TAG_COLORS, fmt, fmtAmount } from '../lib/nutrition';
import { RecipeCover } from '../lib/recipeCovers';
import RecipeToShoppingSheet from '../../../core/components/RecipeToShoppingSheet';

const UNIT_LABEL = { ml: 'ml', Scheibe: 'Sch.', Stück: 'Stk.', Zehe: 'Zehe', EL: 'EL' };

export default function RecipeDetailModal({ recipe, calc, foodsById, currentUserId, isTemplate, onEdit, onDelete, onCopy, onLogMeal, onShoppingAdded, onClose }) {
  // Das Rezept ist für `baseServings` Portionen angelegt: calc und Zutatenmengen
  // gelten dafür. Der Rechner skaliert nur die Anzeige (nichts wird gespeichert).
  const baseServings = Math.max(1, recipe.servings || 1);
  const [portions, setPortions] = useState(baseServings);
  const [showShop, setShowShop] = useState(false);
  const [shopCount, setShopCount] = useState(0); // zuletzt auf die Liste gesetzte Zutaten
  const factor = portions / baseServings;
  const perPortion = (v) => v / baseServings;
  const total = (v) => perPortion(v) * portions;
  const cat = RECIPE_CATS.find((c) => c.key === recipe.category) || RECIPE_CATS[0];
  const isOwner = isTemplate || recipe.ownerId === currentUserId;
  const isShared = !!recipe.householdId;

  return (
    <Modal title={recipe.name} onClose={onClose}>
      <RecipeCover recipe={recipe} className="recipe-detail-cover" fit="meet" />

      {(!isTemplate && onLogMeal) || onShoppingAdded ? (
        <div className="recipe-top-actions">
          {!isTemplate && onLogMeal && (
            <button className="btn btn-primary" onClick={() => onLogMeal(recipe)}>Gegessen eintragen</button>
          )}
          {onShoppingAdded && (
            <button
              className={`btn ${shopCount > 0 ? 'btn-secondary' : 'rts-btn'}`}
              onClick={() => setShowShop(true)}
              disabled={recipe.ingredients.length === 0}
            >
              {shopCount > 0 ? `✓ Auf Liste (${shopCount})` : '🛒 Einkaufsliste'}
            </button>
          )}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        {isTemplate ? (
          <button className="btn btn-primary" onClick={() => onCopy(recipe)}><IconPlus /> Übernehmen</button>
        ) : isOwner ? (
          <>
            <button className="btn btn-secondary" onClick={() => onEdit(recipe)}><IconEdit /> Bearbeiten</button>
            <button className="btn btn-danger" onClick={() => onDelete(recipe.id)}><IconTrash /> Löschen</button>
          </>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="chip">{cat.emoji} {cat.label}</span>
        {isShared && <span className="chip">Vom Haushalt geteilt{!isOwner ? ' (nicht von dir)' : ''}</span>}
      </div>

      <div className="portion-calc">
        <div className="portion-calc-row">
          <div>
            <div className="portion-calc-label">Portionen</div>
            <div className="portion-calc-hint">
              {portions === baseServings
                ? `Angelegt für ${baseServings} Portion${baseServings !== 1 ? 'en' : ''}`
                : <>Angelegt für {baseServings} · <button type="button" className="portion-calc-reset" onClick={() => setPortions(baseServings)}>zurücksetzen</button></>}
            </div>
          </div>
          <div className="portion-stepper">
            <button type="button" aria-label="Eine Portion weniger" disabled={portions <= 1} onClick={() => setPortions((p) => Math.max(1, p - 1))}>−</button>
            <input
              type="number" min="1" max="99" inputMode="numeric" aria-label="Portionen"
              value={portions}
              onChange={(e) => setPortions(Math.min(99, Math.max(1, Math.round(+e.target.value) || 1)))}
            />
            <button type="button" aria-label="Eine Portion mehr" disabled={portions >= 99} onClick={() => setPortions((p) => Math.min(99, p + 1))}>+</button>
          </div>
        </div>
      </div>

      <div className="card nut-facts" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <div className="nut-facts-row head">
          <span />
          <span>Pro Portion</span>
          <span>Gesamt</span>
        </div>
        {[
          ['Kalorien', 'kcal', 'kcal', 0],
          ['Eiweiß', 'protein', 'g', 1],
          ['Kohlenhydrate', 'carbs', 'g', 1],
          ['Fett', 'fat', 'g', 1],
          ['Ballaststoffe', 'fiber', 'g', 1],
        ].map(([label, key, unit, digits]) => (
          <div className="nut-facts-row" key={key}>
            <span>{label}</span>
            <span>{fmt(perPortion(calc[key]), digits)}<small>{unit}</small></span>
            <span>{fmt(total(calc[key]), digits)}<small>{unit}</small></span>
          </div>
        ))}
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>Zutaten für {portions} Portion{portions !== 1 ? 'en' : ''}</div>
        <div className="card" style={{ margin: 0, padding: 0 }}>
          {recipe.ingredients.map((ing, idx) => {
            const food = foodsById[ing.foodId];
            if (!food) return null;
            return (
              <div key={idx} style={{ display: 'flex', padding: '9px 14px', borderBottom: idx < recipe.ingredients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ flex: 1, fontSize: '0.85rem' }}>{food.name}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmtAmount(ing.amount * factor, food.unit)} {UNIT_LABEL[food.unit] || 'g'}</span>
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
      {showShop && (
        <RecipeToShoppingSheet
          recipe={recipe}
          foodsById={foodsById}
          initialPortions={portions}
          onClose={() => setShowShop(false)}
          onDone={(info) => { setShopCount(info.count); onShoppingAdded(info, recipe); }}
        />
      )}
    </Modal>
  );
}
