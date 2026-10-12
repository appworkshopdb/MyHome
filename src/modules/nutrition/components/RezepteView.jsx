import { useMemo, useState } from 'react';
import { IconPlus, IconSearch, IconClose } from '../../../core/components/Icons';
import { RECIPE_CATS, TAG_COLORS, computeNutrition, fmt } from '../lib/nutrition';
import { TEMPLATE_RECIPES } from '../lib/data/templates';
import { RecipeCover } from '../lib/recipeCovers';
import { DIET_FILTERS, NUTRI_FILTERS, ART_GROUPS, SORTS, recipeFacts, applyRecipeFilters, searchScore } from '../lib/recipeFilter';
import RecipeEditorModal from './RecipeEditorModal';
import RecipeFilterSheet from './RecipeFilterSheet';
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
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // Zähler fürs Filter-Sheet: total = in der ganzen Liste (bestimmt, ob ein Chip
  // angeboten wird), shown = bei aktueller Mahlzeit und Suche (Zahl am Chip)
  const counts = useMemo(() => {
    const base = items.filter((it) => (meal === 'all' || it.recipe.category === meal) && searchScore(it.facts, query) !== null);
    const count = (test) => ({ total: items.filter((it) => test(it.facts)).length, shown: base.filter((it) => test(it.facts)).length });
    return {
      diet: Object.fromEntries(DIET_FILTERS.map((d) => [d.key, count(d.test)])),
      nutri: Object.fromEntries(NUTRI_FILTERS.map((n) => [n.key, count(n.test)])),
      art: Object.fromEntries(ART_GROUPS.map((g) => [g.key, count((f) => f.artKey === g.key)])),
    };
  }, [items, meal, query]);
  const mealChips = RECIPE_CATS.filter((c) => c.key === 'all' || items.some((it) => it.recipe.category === c.key));

  const activeCount = (diet ? 1 : 0) + nutri.length + (art ? 1 : 0); // Filter aus dem Sheet
  const filtered = query.trim() !== '' || meal !== 'all' || activeCount > 0;
  const dietLabel = DIET_FILTERS.find((d) => d.key === diet)?.label;
  const artLabel = ART_GROUPS.find((g) => g.key === art)?.label;
  const sortLabel = SORTS.find((o) => o.key === sort)?.label;
  const toggleNutri = (key) => setNutri((n) => (n.includes(key) ? n.filter((k) => k !== key) : [...n, key]));
  function resetSheetFilters() { setDiet(null); setNutri([]); setArt(null); }
  function resetFilters() { setQuery(''); setMeal('all'); resetSheetFilters(); }

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
        <button type="button" className={`nut-filter-btn ${activeCount > 0 ? 'active' : ''}`} aria-label={activeCount > 0 ? `Filter, ${activeCount} aktiv` : 'Filter'} onClick={() => setSheetOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" />
          </svg>
          {activeCount > 0 && <b>{activeCount}</b>}
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        {mealChips.map((c) => (
          <button key={c.key} className={`chip ${meal === c.key ? 'active' : ''}`} onClick={() => setMeal(c.key)}>
            {c.key === 'all' ? 'Alle' : c.label}
          </button>
        ))}
      </div>

      {activeCount > 0 && (
        <div className="chip-row rf-active">
          {diet && <button type="button" className="chip rf-out" onClick={() => setDiet(null)} aria-label={`${dietLabel} entfernen`}>{dietLabel} <IconClose /></button>}
          {nutri.map((k) => {
            const n = NUTRI_FILTERS.find((f) => f.key === k);
            return <button key={k} type="button" className="chip rf-out" onClick={() => toggleNutri(k)} aria-label={`${n.label} entfernen`}>{n.label} <IconClose /></button>;
          })}
          {art && <button type="button" className="chip rf-out" onClick={() => setArt(null)} aria-label={`${artLabel} entfernen`}>{artLabel} <IconClose /></button>}
          <button type="button" className="rf-link" onClick={resetSheetFilters}>Zurücksetzen</button>
        </div>
      )}

      {items.length > 0 && (
        <div className="rf-info">
          <span>{rows.length}{filtered ? ` von ${items.length}` : ''} Rezept{items.length !== 1 ? 'e' : ''}</span>
          <button type="button" className="rf-sort-btn" onClick={() => setSheetOpen(true)}>Sortieren: {sortLabel} ▾</button>
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

      {sheetOpen && (
        <RecipeFilterSheet
          counts={counts}
          diet={diet} setDiet={setDiet}
          nutri={nutri} toggleNutri={toggleNutri}
          art={art} setArt={setArt}
          sort={sort} setSort={setSort}
          resultCount={rows.length}
          activeCount={activeCount}
          onReset={resetSheetFilters}
          onClose={() => setSheetOpen(false)}
        />
      )}

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
