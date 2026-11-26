import { useMemo, useState } from 'react';
import { IconPlus, IconSearch, IconClose } from '../../../core/components/Icons';
import { RECIPE_CATS, computeNutrition, fmt } from '../lib/nutrition';
import { TEMPLATE_RECIPES } from '../lib/data/templates';
import { RecipeCover } from '../lib/recipeCovers';
import { DIET_FILTERS, NUTRI_FILTERS, ART_GROUPS, SORTS, recipeFacts, applyRecipeFilters, searchScore } from '../lib/recipeFilter';
import RecipeEditorModal from './RecipeEditorModal';
import RecipeWizard from './RecipeWizard';
import RecipeFilterSheet from './RecipeFilterSheet';
import RecipeDetailModal from './RecipeDetailModal';
import TemplateCategories from './TemplateCategories';
import { TEMPLATE_CAT_BY_KEY, countTemplateCats } from '../lib/templateCategories';
import Icon from '../../../core/components/Icon';
import { confirmDialog, Segmented, FilterChip, EmptyState, Button } from '../../../core/components/ui';

// Karte bleibt kompakt: statt aller Tags und der ganzen Notiz nur die Anzahl der
// Tags (eigene, Ziele und aus den Zutaten abgeleitete, ohne Doppelte) und ein
// Hinweis, dass eine Notiz existiert. Alles Weitere steht im Rezept-Dialog.
function RecipeMeta({ recipe, calc }) {
  const tagCount = new Set([...(recipe.customTags || []), ...(recipe.goalTags || []), ...(calc.tags || [])]).size;
  if (tagCount === 0 && !recipe.note) return null;
  return (
    <div className="meta-pills">
      {tagCount > 0 && (
        <span className="meta-pill">
          <Icon name="tag" size={16} />
          {tagCount} Tag{tagCount !== 1 ? 's' : ''}
        </span>
      )}
      {recipe.note && (
        <span className="meta-pill">
          <Icon name="note" size={16} />
          Notiz
        </span>
      )}
    </div>
  );
}

export default function RezepteView({
  foods, recipes, currentUserId, onSaveRecipe, onSaveFood, onDeleteRecipe, showToast,
  editing, setEditing, // lifted nach NutritionModule.jsx — siehe dort für Begründung
  onLogMeal,           // "Gegessen eintragen" → Dialog im NutritionModule
  onShoppingAdded,     // Zutaten auf die Einkaufsliste gesetzt → Hinweis mit Rückgängig im NutritionModule
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
  const [cat, setCat] = useState(null); // geöffnete Vorlagen-Kategorie (nur Tab Vorlagen)

  const foodsById = useMemo(() => Object.fromEntries(foods.map((f) => [f.id, f])), [foods]);

  const source = tab === 'eigene' ? recipes : TEMPLATE_RECIPES;
  const allItems = useMemo(() => source.map((recipe) => {
    const calc = computeNutrition(recipe.ingredients, foodsById);
    const mealLabel = RECIPE_CATS.find((c) => c.key === recipe.category)?.label || '';
    return { recipe, calc, facts: recipeFacts(recipe, calc, foodsById, mealLabel) };
  }), [source, foodsById]);
  const catDef = tab === 'vorlagen' && cat ? TEMPLATE_CAT_BY_KEY[cat] : null;
  const items = useMemo(() => (catDef ? allItems.filter(catDef.test) : allItems), [allItems, catDef]);
  const catCounts = useMemo(() => (tab === 'vorlagen' ? countTemplateCats(allItems) : null), [allItems, tab]);

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
  // Vorlagen: ohne Suche, Filter und geöffnete Kategorie zeigt die Seite die Kategorien
  const showCats = tab === 'vorlagen' && !cat && query.trim() === '' && meal === 'all' && activeCount === 0;
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
    if (!(await confirmDialog({ title: 'Rezept löschen?' }))) return;
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
      {catDef ? (
        <div className="tpl-top">
          <button type="button" className="tpl-back" aria-label="Zurück zu den Kategorien" onClick={() => { setCat(null); setMeal('all'); resetSheetFilters(); }}>
            <Icon name="back" size={20} />
          </button>
          <div>
            <div className="tpl-top-t">{catDef.label}</div>
            <div className="tpl-top-s">{items.length} Rezepte{catDef.hint ? ` · ${catDef.hint}${catDef.perPortion ? ' pro Portion' : ''}` : ''}</div>
          </div>
        </div>
      ) : (
      <Segmented
        label="Rezepte"
        options={[{ value: 'eigene', label: 'Eigene Rezepte' }, { value: 'vorlagen', label: 'Vorlagen' }]}
        value={tab}
        onChange={(v) => { setTab(v); setCat(null); }}
      />
      )}

      <div className="nut-searchbar">
        <div className="nut-search">
          <IconSearch />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rezept suchen…"
            aria-label="Rezepte durchsuchen"
          />
          {query && <button type="button" className="nut-search-clear" aria-label="Suche leeren" onClick={() => setQuery('')}><Icon name="close" size={null} className="glyph" /></button>}
        </div>
        <button type="button" className={`nut-filter-btn ${activeCount > 0 ? 'active' : ''}`} aria-label={activeCount > 0 ? `Filter, ${activeCount} aktiv` : 'Filter'} onClick={() => setSheetOpen(true)}>
          <Icon name="filter" size={20} />
          {activeCount > 0 && <b>{activeCount}</b>}
        </button>
      </div>

      {showCats && <TemplateCategories counts={catCounts} onPick={(k) => { setCat(k); setMeal('all'); }} />}

      {!showCats && catDef?.kind !== 'meal' && (!catDef || mealChips.length > 2) && (
      <div className="chip-row rf-meals">
        {mealChips.map((c) => (
          <FilterChip key={c.key} selected={meal === c.key} onClick={() => setMeal(c.key)}>
            {c.key === 'all' ? 'Alle' : c.label}
          </FilterChip>
        ))}
      </div>
      )}

      {!showCats && activeCount > 0 && (
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

      {!showCats && items.length > 0 && (
        <div className="rf-info">
          <span>{rows.length}{filtered ? ` von ${items.length}` : ''} Rezept{items.length !== 1 ? 'e' : ''}</span>
          <button type="button" className="rf-sort-btn" onClick={() => setSheetOpen(true)}>Sortieren: {sortLabel} <Icon name="expand" size={null} className="glyph" /></button>
        </div>
      )}

      {!showCats && items.length === 0 && (
        <EmptyState
          icon="food"
          title={tab === 'eigene' ? 'Noch keine Rezepte' : 'Keine Vorlagen'}
          action={tab === 'eigene' ? { label: 'Erstes Rezept', onClick: () => setEditing(null) } : undefined}
        />
      )}

      {!showCats && items.length > 0 && rows.length === 0 && (
        <EmptyState icon="search" title="Keine Treffer" action={{ label: 'Filter zurücksetzen', icon: 'restore', onClick: resetFilters }} />
      )}

      {!showCats && rows.map(({ recipe: r, calc, facts }) => (
        <div key={r.id} className="card recipe-card" onClick={() => setDetail(r)}>
          <div className="head">
            <RecipeCover recipe={r} className="thumb" />
            <div className="recipe-main">
              <div className="title">{r.name}</div>
              <div className="macros">{Math.round(facts.kcal)} kcal · {fmt(facts.protein)}g Eiweiß pro Portion</div>
              <RecipeMeta recipe={r} calc={calc} />
            </div>
            <div className="recipe-side">
              <span className="recipe-box" title={`${r.servings} Portion${Number(r.servings) !== 1 ? 'en' : ''}`} aria-label={`${r.servings} Portion${Number(r.servings) !== 1 ? 'en' : ''}`}>
                <Icon name="pan" size={18} />
                {r.servings}
              </span>
              <span className="recipe-box" title={`${r.ingredients.length} Zutat${r.ingredients.length !== 1 ? 'en' : ''}`} aria-label={`${r.ingredients.length} Zutat${r.ingredients.length !== 1 ? 'en' : ''}`}>
                <Icon name="leaf" size={18} />
                {r.ingredients.length}
              </span>
            </div>
          </div>
          {tab === 'vorlagen' && (
            <Button block icon="plus" className="rf-copy" onClick={(e) => { e.stopPropagation(); copyTemplate(r); }}>Zu meinen Rezepten</Button>
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

      {/* Neues Rezept: Wizard (Basis → Zutaten → Zusammenfassung). Bearbeiten: wie bisher der Editor. */}
      {editing === null && (
        <RecipeWizard
          foods={foods}
          foodsById={foodsById}
          onSave={handleSave}
          onSaveFood={onSaveFood}
          onClose={() => setEditing(undefined)}
        />
      )}
      {editing !== undefined && editing !== null && (
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
          onShoppingAdded={onShoppingAdded}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
