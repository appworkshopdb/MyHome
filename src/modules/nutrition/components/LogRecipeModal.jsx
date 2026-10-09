import { useMemo, useState } from 'react';
import Modal from '../../../core/components/Modal';
import { IconSearch } from '../../../core/components/Icons';
import { MEAL_TYPES, computeNutrition, fmt } from '../lib/nutrition';
import { mealFromRecipe, defaultMealType, todayStr } from '../lib/meals';

// Ein eigenes Rezept als gegessene Mahlzeit eintragen (Bereich "Mahlzeiten").
// recipe === null → zuerst ein Rezept aus der Liste wählen; sonst direkt das Formular.
// Die Werte sind genau (keine Schätzung): Portionen × Nährwerte pro Portion.
export default function LogRecipeModal({ recipe: initial, recipes, foodsById, onSave, onClose }) {
  const [recipe, setRecipe]   = useState(initial || null);
  const [query, setQuery]     = useState('');
  const [portions, setPortions] = useState('1');
  const [mealType, setMealType] = useState(() => initial?.category || defaultMealType());
  const [eatenOn, setEatenOn]   = useState(() => todayStr());
  const [saving, setSaving]     = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const calc = useMemo(
    () => (recipe ? computeNutrition(recipe.ingredients, foodsById) : null),
    [recipe, foodsById],
  );

  const portionsNum = parseFloat(String(portions).replace(',', '.'));
  const valid = recipe && portionsNum > 0 && portionsNum <= 50 && eatenOn;
  const factor = recipe && valid ? portionsNum / (recipe.servings || 1) : 0;

  function pick(r) {
    setRecipe(r);
    setMealType(r.category || defaultMealType());
  }

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave(mealFromRecipe(recipe, calc, portionsNum, foodsById, { mealType, eatenOn }));
    } catch (err) {
      console.error('[meal-save]', err);
      setSaving(false); // Fehlermeldung zeigt der Aufrufer; Dialog bleibt offen
    }
  }

  // ── Schritt 1: Rezept wählen ──
  if (!recipe) {
    return (
      <Modal title="Rezept eintragen" onClose={onClose}>
        {recipes.length === 0 ? (
          <div className="empty-state">
            <p>Noch keine eigenen Rezepte — lege zuerst im Bereich „Rezepte" eins an.</p>
          </div>
        ) : (
          <>
            <div className="form-group">
              <div className="search-box" style={{ position: 'relative' }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rezept suchen…"
                  aria-label="Rezept suchen"
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><IconSearch /></span>
              </div>
            </div>
            <div className="card" style={{ margin: 0, padding: 0 }}>
              {filtered.length === 0 && <div className="meal-hint" style={{ padding: 14 }}>Kein Rezept gefunden.</div>}
              {filtered.map((r, idx) => {
                const c = computeNutrition(r.ingredients, foodsById);
                const perServing = Math.round(c.kcal / (r.servings || 1));
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="meal-pick-row"
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onClick={() => pick(r)}
                  >
                    <span className="meal-pick-name">{r.name}</span>
                    <span className="meal-item-kcal">{perServing} kcal pro Portion</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    );
  }

  // ── Schritt 2: Portionen, Typ, Datum ──
  return (
    <Modal title={recipe.name} onClose={onClose}>
      <div className="result-grid">
        <div className="result-tile" style={{ gridColumn: '1 / -1' }}>
          <div className="label">Nährwerte für {valid ? +portionsNum.toFixed(2) : '–'} Portion{portionsNum === 1 ? '' : 'en'}</div>
          <div className="value">{valid ? Math.round(calc.kcal * factor) : '–'}<span>kcal</span></div>
        </div>
        <div className="result-tile"><div className="label">Eiweiß</div><div className="value">{valid ? fmt(calc.protein * factor) : '–'}<span>g</span></div></div>
        <div className="result-tile"><div className="label">Kohlenhydrate</div><div className="value">{valid ? fmt(calc.carbs * factor) : '–'}<span>g</span></div></div>
        <div className="result-tile"><div className="label">Fett</div><div className="value">{valid ? fmt(calc.fat * factor) : '–'}<span>g</span></div></div>
        <div className="result-tile"><div className="label">Ballaststoffe</div><div className="value">{valid ? fmt(calc.fiber * factor) : '–'}<span>g</span></div></div>
      </div>

      <div className="form-group">
        <label>Portionen (Rezept ergibt {recipe.servings || 1})</label>
        <input type="number" inputMode="decimal" min="0.25" step="0.25" value={portions} onChange={(e) => setPortions(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Mahlzeit</label>
        <div className="segmented cols-4">
          {MEAL_TYPES.map((t) => (
            <button key={t.key} type="button" className={mealType === t.key ? 'active' : ''} onClick={() => setMealType(t.key)}>
              <div>{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Datum</label>
        <input type="date" value={eatenOn} onChange={(e) => setEatenOn(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={!valid || saving} onClick={save}>
          {saving ? 'Speichert…' : 'Mahlzeit speichern'}
        </button>
        <button className="btn btn-secondary" onClick={initial ? onClose : () => setRecipe(null)}>
          {initial ? 'Abbrechen' : 'Zurück'}
        </button>
      </div>
    </Modal>
  );
}
