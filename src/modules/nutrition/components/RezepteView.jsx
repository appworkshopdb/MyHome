import { useMemo, useState } from 'react';
import { IconPlus, IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';
import { RECIPE_CATS, TAG_COLORS, computeNutrition, fmt } from '../lib/nutrition';
import { TEMPLATE_RECIPES } from '../lib/data/templates';
import RecipeEditorModal from './RecipeEditorModal';
import RecipeDetailModal from './RecipeDetailModal';

export default function RezepteView({ foods, recipes, onSaveRecipe, onDeleteRecipe, showToast }) {
  const [tab, setTab] = useState('eigene'); // 'eigene' | 'vorlagen'
  const [catIndex, setCatIndex] = useState(0);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [detail, setDetail] = useState(null);

  const foodsById = useMemo(() => Object.fromEntries(foods.map((f) => [f.id, f])), [foods]);

  const source = tab === 'eigene' ? recipes : TEMPLATE_RECIPES;
  const cat = RECIPE_CATS[catIndex];
  const list = cat.key === 'all' ? source : source.filter((r) => r.category === cat.key);

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

      <div className="cat-carousel">
        <button className="btn-icon" disabled={catIndex === 0} onClick={() => setCatIndex((i) => Math.max(0, i - 1))}><IconChevronLeft /></button>
        <div className="center">
          <div className="emoji">{cat.emoji}</div>
          <div className="label">{cat.label}</div>
          <div className="count">{list.length} Rezept{list.length !== 1 ? 'e' : ''}</div>
        </div>
        <button className="btn-icon" disabled={catIndex === RECIPE_CATS.length - 1} onClick={() => setCatIndex((i) => Math.min(RECIPE_CATS.length - 1, i + 1))}><IconChevronRight /></button>
      </div>
      <div className="cat-dots">
        {RECIPE_CATS.map((c, i) => <span key={c.key} className={`dot ${i === catIndex ? 'active' : ''}`} onClick={() => setCatIndex(i)} />)}
      </div>

      {list.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem' }}>{cat.emoji}</div>
          <p>{tab === 'eigene' ? 'Noch keine Rezepte' : 'Keine Vorlage in dieser Kategorie'}</p>
          {tab === 'eigene' && <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setEditing(null)}>+ Erstes Rezept</button>}
        </div>
      )}

      {list.map((r) => {
        const calc = computeNutrition(r.ingredients, foodsById);
        const rc = RECIPE_CATS.find((c) => c.key === r.category) || RECIPE_CATS[0];
        return (
          <div key={r.id} className="card recipe-card" onClick={() => setDetail(r)}>
            <div className="head">
              <span className="emoji">{rc.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="title">{r.name}</span>
                  <span className="servings">{r.servings} Port.</span>
                </div>
                <div className="macros">{Math.round(calc.kcal)} kcal · {fmt(calc.protein)}g Protein</div>
                <div className="tags">
                  {(r.goalTags || []).map((t) => <span key={t} className="goal-tag">{t}</span>)}
                  {(r.customTags || []).map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
                  {calc.tags.slice(0, 2).map((t) => <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || 'var(--text-muted)' }}>{t}</span>)}
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
        );
      })}

      {tab === 'eigene' && (
        <button className="fab" onClick={() => setEditing(null)}><IconPlus /></button>
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
          isTemplate={tab === 'vorlagen'}
          onEdit={(r) => { setDetail(null); setEditing(r); }}
          onDelete={handleDelete}
          onCopy={copyTemplate}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
