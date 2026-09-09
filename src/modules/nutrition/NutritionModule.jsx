import { useCallback, useEffect, useState } from 'react';
import './nutrition.css';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile, BODY_REQUIRED_FIELDS } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import PageSection from '../../core/components/PageSection';
import AmpelView from './components/AmpelView';
import RezepteView from './components/RezepteView';
import LexikonView from './components/LexikonView';
import TippsView from './components/TippsView';
import * as db from './lib/nutData';

registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(BODY_REQUIRED_FIELDS, body);
});

// KEINE TABS MEHR: Rezepte/Ampel/Lexikon/Tipps liegen als vier
// PageSection-Blöcke untereinander, in derselben Reihenfolge wie die
// früheren Tabs.
//
// BESONDERHEIT diese Modul: RezepteView UND AmpelView hatten JEWEILS
// einen eigenen fest positionierten "+"-Button (".global-fab", identisch
// positioniert wie der App-weite FAB) — deshalb blendete sich der
// globale FAB für "nutrition" bisher komplett aus (siehe GlobalFab.jsx).
// Das ging nur gut, weil immer nur einer der beiden Tabs sichtbar war.
// Auf der zusammengelegten Seite wären jetzt BEIDE FABs gleichzeitig im
// DOM und würden sich exakt überlappen.
//
// Lösung: "editing"/"foodForm" werden hierher gehoben (lifted state,
// gleiches Muster wie editingPlan in SportModule), der globale FAB
// (core/, darf nicht aus modules/ importieren) zeigt bei Ernährung eine
// kleine Moduswahl "Neues Rezept"/"Neues Lebensmittel" und feuert dafür
// ein window-Event — GENAU wie sport:data-changed, nur in die andere
// Richtung. Dieses Modul hört zu und öffnet den passenden, unverändert
// bestehenden Dialog (RecipeEditorModal/FoodFormModal). Kein Import
// zwischen core/ und modules/nutrition/ nötig, keine Dopplung der
// bestehenden, funktionierenden Formulare.
export default function NutritionModule({ hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lifted aus RezepteView: undefined = geschlossen, null = neu, Objekt = bearbeiten
  const [editingRecipe, setEditingRecipe] = useState(undefined);
  // Lifted aus AmpelView
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [editingFood, setEditingFood]   = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [customFoods, recipeRows] = await Promise.all([
        db.getCustomFoods(session),
        db.getRecipes(session),
      ]);
      setFoods(db.mergeFoods(customFoods));
      setRecipes(recipeRows);
    } catch (e) {
      console.error(e);
      showToast('Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [session, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Hört auf den globalen FAB (GlobalFab.jsx, core/) — der darf nicht
  // direkt in dieses Modul reinrufen, deshalb window-Events statt Props.
  useEffect(() => {
    function openNewRecipe() { setEditingRecipe(null); }
    function openNewFood()   { setEditingFood(null); setShowFoodForm(true); }
    window.addEventListener('nutrition:new-recipe', openNewRecipe);
    window.addEventListener('nutrition:new-food', openNewFood);
    return () => {
      window.removeEventListener('nutrition:new-recipe', openNewRecipe);
      window.removeEventListener('nutrition:new-food', openNewFood);
    };
  }, []);

  async function handleSaveFood(food) {
    await db.saveFood(session, food);
    const customFoods = await db.getCustomFoods(session);
    setFoods(db.mergeFoods(customFoods));
  }

  async function handleDeleteFood(food) {
    if (!food._rowId) return; // Seed-Lebensmittel ohne eigene Änderung lassen sich nicht löschen
    await db.deleteFood(food._rowId);
    const customFoods = await db.getCustomFoods(session);
    setFoods(db.mergeFoods(customFoods));
  }

  async function handleSaveRecipe(recipe) {
    const saved = await db.saveRecipe(session, recipe);
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
    });
    return saved;
  }

  async function handleDeleteRecipe(id) {
    await db.deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="loading-note with-topbar-space">Lädt…</div>
      </>
    );
  }

  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />

      <div className="nut-module-content with-topbar-space">
        <PageSection title="Rezepte">
          <RezepteView
            foods={foods}
            recipes={recipes}
            currentUserId={session.user.id}
            onSaveRecipe={handleSaveRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            showToast={showToast}
            editing={editingRecipe}
            setEditing={setEditingRecipe}
          />
        </PageSection>

        <PageSection title="Ampel">
          <AmpelView
            foods={foods}
            currentUserId={session.user.id}
            onSaveFood={handleSaveFood}
            onDeleteFood={handleDeleteFood}
            showForm={showFoodForm}
            setShowForm={setShowFoodForm}
            formFood={editingFood}
            setFormFood={setEditingFood}
          />
        </PageSection>

        <PageSection title="Lexikon">
          <LexikonView />
        </PageSection>

        <PageSection title="Tipps">
          <TippsView />
        </PageSection>
      </div>
    </>
  );
}
