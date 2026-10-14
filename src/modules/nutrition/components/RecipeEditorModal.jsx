import { useMemo, useState } from 'react';
import Modal from '../../../core/components/Modal';
import { IconSearch, IconPlus, IconClose } from '../../../core/components/Icons';
import { RECIPE_CATS, GOAL_TAGS, CUSTOM_TAGS, computeNutrition, fmt, basis } from '../lib/nutrition';
import { COVER_MOTIFS, COVER_TONES, CoverArt, parseCover, resolveCover, formatCover } from '../lib/recipeCovers';

const UNIT_SHORT = { ml: 'ml', Scheibe: 'Sch', Stück: 'Stk', Zehe: 'Zehe', EL: 'EL' };
const DEFAULT_AMOUNT = { ml: 200, Stück: 1, Scheibe: 1, Zehe: 1, EL: 1 };

export default function RecipeEditorModal({ recipe, foods, foodsById, onSave, onClose }) {
  const [draft, setDraft] = useState(() => recipe ? {
    ...recipe,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    customTags: recipe.customTags || [],
    goalTags: recipe.goalTags || [],
    cover: recipe.cover ?? null,
  } : {
    name: '', servings: 1, category: 'mittag', ingredients: [], note: '', customTags: [], goalTags: [], cover: null,
  });
  const [query, setQuery] = useState('');

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foods, query]);

  function addIngredient(food) {
    const amount = DEFAULT_AMOUNT[food.unit] || 100;
    set('ingredients', [...draft.ingredients, { foodId: food.id, amount }]);
    setQuery('');
  }
  function removeIngredient(idx) {
    set('ingredients', draft.ingredients.filter((_, i) => i !== idx));
  }
  function updateAmount(idx, amount) {
    set('ingredients', draft.ingredients.map((ing, i) => (i === idx ? { ...ing, amount } : ing)));
  }
  function toggleIn(list, value) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  const calc = useMemo(() => computeNutrition(draft.ingredients, foodsById), [draft.ingredients, foodsById]);
  const canSave = draft.name.trim() && draft.ingredients.length > 0 && draft.category;

  function save() {
    if (!canSave) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      servings: Math.max(1, +draft.servings || 1),
      ingredients: draft.ingredients.map((i) => ({ foodId: i.foodId, amount: +String(i.amount).replace(',', '.') || 0 })),
      note: (draft.note || '').trim(),
    });
  }

  // Bild: gespeicherte Wahl (chosen) oder automatisch aus Name/Mahlzeit-Typ (resolved)
  const chosen = parseCover(draft.cover);
  const resolved = resolveCover(draft);

  const extraCustomTags = (draft.customTags || []).filter((t) => !CUSTOM_TAGS.includes(t));

  return (
    <Modal title={recipe ? 'Rezept bearbeiten' : 'Neues Rezept'} onClose={onClose}>
      <div className="form-group">
        <label>Name</label>
        <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Rezeptname" />
      </div>

      <div className="form-group">
        <label>Für wie viele Portionen ist das Rezept?</label>
        <input type="number" min="1" value={draft.servings} onChange={(e) => set('servings', e.target.value)} />
        <div className="nut-hint">Die Zutatenmengen unten gelten für diese Anzahl Portionen. Im Rezept kannst du sie später umrechnen.</div>
      </div>

      <div className="form-group">
        <label>Kategorie</label>
        <div className="segmented cols-4">
          {RECIPE_CATS.filter((c) => c.key !== 'all').map((c) => (
            <button key={c.key} type="button" className={draft.category === c.key ? 'active' : ''} onClick={() => set('category', c.key)}>
              <div>{c.emoji}</div>
              <div>{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Bild</label>
        <CoverArt motif={resolved.motif} tone={resolved.tone} className="cover-picker-preview" fit="meet" />
        <div className="cover-grid">
          <button type="button" className={`cover-option${!chosen ? ' active' : ''}`} onClick={() => set('cover', null)}>
            <span className="recipe-cover rc-tone-grau" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Auto</span>
            <span className="name">Automatisch</span>
          </button>
          {COVER_MOTIFS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`cover-option${chosen?.motif.key === m.key ? ' active' : ''}`}
              onClick={() => set('cover', formatCover(m.key, chosen ? chosen.tone : m.tone))}
              aria-label={m.label}
            >
              <CoverArt motif={m} tone={chosen ? chosen.tone : m.tone} />
              <span className="name">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="cover-tones" role="group" aria-label="Hintergrundfarbe">
          {COVER_TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`cover-tone recipe-cover rc-tone-${t.key}${resolved.tone === t.key ? ' active' : ''}`}
              aria-label={t.label}
              onClick={() => set('cover', formatCover(resolved.motif.key, t.key))}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Zutaten ({draft.ingredients.length})</label>
        <div className="nut-search" style={{ marginBottom: 6 }}>
          <IconSearch />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lebensmittel suchen…" />
        </div>
        {results.length > 0 && (
          <div className="card" style={{ margin: '0 0 10px', padding: 0 }}>
            {results.map((f) => (
              <div key={f.id} className="ing-pick-row">
                <div className="ing-pick-info">
                  <span className="ing-pick-name">{f.name}</span>
                  <span className="ing-pick-kcal">{f.kcal} kcal/{basis(f.unit)}</span>
                </div>
                <button type="button" className="ing-add" aria-label={`${f.name} hinzufügen`} onClick={() => addIngredient(f)}>
                  <IconPlus />
                </button>
              </div>
            ))}
          </div>
        )}
        {draft.ingredients.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>Zutaten oben suchen und hinzufügen</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draft.ingredients.map((ing, idx) => {
              const food = foodsById[ing.foodId];
              if (!food) return null;
              return (
                <div className="ingredient-row" key={idx}>
                  <span className="food-name">{food.name}</span>
                  <input
                    type="number" min="0"
                    step={['Stück', 'Scheibe', 'Zehe', 'EL'].includes(food.unit) ? 1 : 10}
                    value={ing.amount}
                    onChange={(e) => updateAmount(idx, e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 32 }}>{UNIT_SHORT[food.unit] || 'g'}</span>
                  <button className="btn-icon" onClick={() => removeIngredient(idx)}><IconClose /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {draft.ingredients.length > 0 && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">Nährwerte gesamt ({Math.max(1, +draft.servings || 1)} Port.)</div>
          <div className="result-grid">
            <div className="result-tile"><div className="label">kcal</div><div className="value">{Math.round(calc.kcal)}</div></div>
            <div className="result-tile"><div className="label">Protein</div><div className="value">{fmt(calc.protein)}<span>g</span></div></div>
            <div className="result-tile"><div className="label">KH</div><div className="value">{fmt(calc.carbs)}<span>g</span></div></div>
            <div className="result-tile"><div className="label">Fett</div><div className="value">{fmt(calc.fat)}<span>g</span></div></div>
          </div>
          <div className="nut-hint">
            Pro Portion: {Math.round(calc.kcal / Math.max(1, +draft.servings || 1))} kcal · {fmt(calc.protein / Math.max(1, +draft.servings || 1))} g Eiweiß
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Passt zu Zielen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GOAL_TAGS.map((t) => (
            <button
              key={t}
              className="chip"
              style={(draft.goalTags || []).includes(t) ? { background: 'var(--accent)', color: 'var(--on-accent)' } : {}}
              onClick={() => set('goalTags', toggleIn(draft.goalTags || [], t))}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Eigene Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {CUSTOM_TAGS.map((t) => (
            <button
              key={t}
              className="chip"
              style={(draft.customTags || []).includes(t) ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' } : {}}
              onClick={() => set('customTags', toggleIn(draft.customTags || [], t))}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          placeholder="+ eigener Tag (Enter)"
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
              const v = e.target.value.trim();
              if (!(draft.customTags || []).includes(v)) set('customTags', [...(draft.customTags || []), v]);
              e.target.value = '';
            }
          }}
        />
        {extraCustomTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {extraCustomTags.map((t) => (
              <span key={t} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {t}
                <button onClick={() => set('customTags', (draft.customTags || []).filter((x) => x !== t))}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Notiz</label>
        <textarea rows={3} value={draft.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Zubereitungshinweise, Variationen…" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>Speichern</button>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  );
}
