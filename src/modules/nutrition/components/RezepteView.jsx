import { useMemo, useState } from 'react';
import { IconPlus, IconSearch } from '../../../core/components/Icons';
import { RECIPE_CATS, TAG_COLORS, computeNutrition, fmt } from '../lib/nutrition';
import { TEMPLATE_RECIPES } from '../lib/data/templates';
import { RecipeCover } from '../lib/recipeCovers';
import { DIET_FILTERS, NUTRI_FILTERS, ART_GROUPS, SORTS, recipeFacts, applyRecipeFilters } from '../lib/recipeFilter';
import RecipeEditorModal from './RecipeEditorModal';
import RecipeDetailModal from './RecipeDetailModal';

export default function RezepteView({
  foods, recipes, currentUserId, onSaveRecipe, onDeleteRecipe, showToast,
  editing, setEditing, // lifted nach NutritionModule.jsx — siehe dort für Begründung
  onLogMeal,           // "Gegessen eintragen" → Dialog im NutritionModule
}) {
  const [tab, setTab] = useState('eigene'); // 'eigene' | 'vorlagen'
  const [detail, setDetail] = useState(null);

  // Suche und Filter (nur Ansicht, nichts davon wird gespeichert)
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState('all');
  const [diet, setDiet] = useState(null);
  const [nutri, setNutri] = useState([]);
  const [art, setArt] = useState(null);
  const [sort, setSort] = useState('standard');
  const [moreOpen, setMoreOpen] = useState(false);

  const foodsById = useMemo(() => Object.fromEntries(foods.map((f) => [f.id, f])), [foods]);

  const source = tab === 'eigene' ? recipes : TEMPLATE_RECIPES;
  const items = useMemo(() => source.map((recipe) => {
    const calc = computeNutrition(recipe.ingredients, foodsById);
    const mealLabel = RECIPE_CATS.find((c) => c.key === recipe.category)?.label || '';
    return { recipe, calc, facts: recipeFacts(recipe, calc, foodsById, mealLabel) };
  }), [source, foodsById]);

  const rows = useMemo(
    () => applyRecipeFilters(items, { query, meal, diet, nutri, art, sort, newestFirst: tab === 'eigene' }),
    [items, query, meal, diet, nutri, art, sort, tab],
  );

  // Nur Filter anbieten, zu denen es in dieser Liste mindestens ein Rezept gibt
  const mealChips = RECIPE_CATS.filter((c) => c.key === 'all' || items.some((it) => it.recipe.category === c.key));
  const dietChips = DIET_FILTERS.filter((d) => items.some((it) => d.test(it.facts)));
  const nutriChips = NUTRI_FILTERS.filter((n) => items.some((it) => n.test(it.facts)));
  const artChips = ART_GROUPS.filter((g) => items.some((it) => it.facts.artKey === g.key));

  const moreCount = (diet ? 1 : 0) + nutri.length + (art ? 1 : 0);
  const filtered = query.trim() !== '' || meal !== 'all' || moreCount > 0;
  const toggleNutri = (key) => setNutri((n) => (n.includes(key) ? n.filter((k) => k !== key) : [...n, key]));
  function resetFilters() { setQuery(''); setMeal('all'); setDiet(null); setNutri([]); setArt(null); }

  async function handleSave(recipe) {
    await onSaveRecipe(recipe);
    setEditing(undefined);
    setDetail(null);
  }

  async function handleDelete(id) {
    if (!confirm('Rezept wirklich löschen?')) return;
    await onDeleteRecipe(id);
    setDetail(null);
  }

  async function copyTemplate(template) {
    await onSaveRecipe({
      name: template.name,
      servings: template.servings,
      category: template.category,
      ingredients: template.ingredients.map((i) => ({ foodId: i.foodId, amount: i.amount })),
      note: template.note || '',
      customTags: [],
      goalTags: [],
    });
    setDetail(null);
    setTab('eigene');
    showToast?.(`"${template.name}" zu deinen Rezepten hinzugefügt`);
  }

  return (
    <>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip ${tab === 'eigene' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }} onClick={() => setTab('eigene')}>Eigene Rezepte</button>
        <button className={`chip ${tab === 'vorlagen' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }} onClick={() => setTab('vorlagen')}>Vorlagen</button>
      </div>

      <div className="nut-search">
        <IconSearch />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rezept, Zutat oder Tag suchen…"
          aria-label="Rezepte durchsuchen"
        />
        {query && <button type="button" className="nut-search-clear" aria-label="Suche leeren" onClick={() => setQuery('')}>×</button>}
      </div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        {mealChips.map((c) => (
          <button key={c.key} className={`chip ${meal === c.key ? 'active' : ''}`} onClick={() => setMeal(c.key)}>
            {c.key === 'all' ? 'Alle' : c.label}
          </button>
        ))}
      </div>

      <div className="rf-bar">
        <button type="button" className={`chip ${moreOpen || moreCount > 0 ? 'active' : ''}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          Filter{moreCount > 0 ? ` · ${moreCount}` : ''} {moreOpen ? '▴' : '▾'}
        </button>
        <label className="rf-sort">
          <span>Sortieren</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {moreOpen && (
        <div className="rf-panel">
          {dietChips.length > 0 && (
            <div className="rf-group">
              <div className="rf-group-label">Ernährung</div>
              <div className="rf-chips">
                {dietChips.map((d) => (
                  <button key={d.key} className={`chip ${diet === d.key ? 'active' : ''}`} onClick={() => setDiet(diet === d.key ? null : d.key)}>{d.label}</button>
                ))}
              </div>
            </div>
          )}
          {nutriChips.length > 0 && (
            <div className="rf-group">
              <div className="rf-group-label">Nährwerte pro Portion</div>
              <div className="rf-chips">
                {nutriChips.map((n) => (
                  <button key={n.key} className={`chip ${nutri.includes(n.key) ? 'active' : ''}`} onClick={() => toggleNutri(n.key)}>
                    {n.label} <small>{n.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {artChips.length > 0 && (
            <div className="rf-group">
              <div className="rf-group-label">Gerichtart</div>
              <div className="rf-chips">
                {artChips.map((g) => (
                  <button key={g.key} className={`chip ${art === g.key ? 'active' : ''}`} onClick={() => setArt(art === g.key ? null : g.key)}>{g.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="rf-info">
          <span>{rows.length}{filtered ? ` von ${items.length}` : ''} Rezept{items.length !== 1 ? 'e' : ''}</span>
          {filtered && <button type="button" onClick={resetFilters}>Filter zurücksetzen</button>}
        </div>
      )}

      {items.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem' }}>🍽️</div>
          <p>{tab === 'eigene' ? 'Noch keine Rezepte' : 'Keine Vorlagen vorhanden'}</p>
          {tab === 'eigene' && <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setEditing(null)}>+ Erstes Rezept</button>}
        </div>
      )}

      {items.length > 0 && rows.length === 0 && (
        <div className="empty-state">
          <IconSearch />
          <p>Keine Treffer</p>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={resetFilters}>Filter zurücksetzen</button>
        </div>
      )}

      {rows.map(({ recipe: r, calc, facts }) => (
        <div key={r.id} className="card recipe-card" onClick={() => setDetail(r)}>
          <div className="head">
            <RecipeCover recipe={r} className="thumb" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="title">{r.name}</span>
                <span className="servings">{r.servings} Port.</span>
              </div>
              <div className="macros">{Math.round(facts.kcal)} kcal · {fmt(facts.protein)}g Eiweiß pro Portion</div>
              <div className="tags">
                {(r.goalTags || []).map((t) => <span key={t} className="goal-tag">{t}</span>)}
                {(r.customTags || []).map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
                {calc.tags.filter((t) => !(r.customTags || []).includes(t)).slice(0, 2).map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
              </div>
              {r.note && <p className="note">{r.note}</p>}
            </div>
          </div>
          {tab === 'vorlagen' && (
            <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={(e) => { e.stopPropagation(); copyTemplate(r); }}>
              <IconPlus /> Zu meinen Rezepten
            </button>
          )}
        </div>
      ))}

      {editing !== undefined && (
        <RecipeEditorModal
          recipe={editing}
          foods={foods}
          foodsById={foodsById}
          onSave={handleSave}
          onClose={() => setEditing(undefined)}
        />
      )}

      {detail && (
        <RecipeDetailModal
          recipe={detail}
          calc={computeNutrition(detail.ingredients, foodsById)}
          foodsById={foodsById}
          currentUserId={currentUserId}
          isTemplate={tab === 'vorlagen'}
          onEdit={(r) => { setDetail(null); setEditing(r); }}
          onDelete={handleDelete}
          onCopy={copyTemplate}
          onLogMeal={onLogMeal ? (r) => { setDetail(null); onLogMeal(r); } : undefined}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
