import { useCallback, useEffect, useState } from 'react';
import './nutrition.css';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile, BODY_REQUIRED_FIELDS } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import OverviewSection from './components/OverviewSection';
import AmpelView from './components/AmpelView';
import RezepteView from './components/RezepteView';
import LexikonView from './components/LexikonView';
import TippsView from './components/TippsView';
import MealScanModal from './components/MealScanModal';
import * as db from './lib/nutData';

registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(BODY_REQUIRED_FIELDS, body);
});

// NEU (UMBAU-PLAN.md Schritt 9): kein Stapel aus vier PageSection-Blöcken
// mehr — ohne `view` zeigt sich die Übersicht (Ampel-Fokuskarte mit
// Suchfeld, Rezeptkarten, Bereiche), mit `view` genau EIN Bereich als
// Vollbild-Detail-Screen.
//
// KEIN "Mein Profil" im Modul: Körperdaten, Trainingsfokus, Sportarten
// und Ernährungsform liegen ausschließlich auf der Profilseite oben
// rechts (core/Profile.jsx). Das Mockup listet "Mein Profil" als
// Bereich — bewusst nicht umgesetzt, sonst gäbe es zwei Oberflächen für
// dieselben Daten. ProfilView.jsx bleibt deshalb ungenutzt liegen.
//
// BESONDERHEIT dieses Moduls (unverändert): RezepteView UND AmpelView
// hatten je einen eigenen fest positionierten "+"-Button. "editing"/
// "foodForm" liegen deshalb hier (lifted state); der globale FAB
// (core/, darf nicht aus modules/ importieren) zeigt bei Ernährung eine
// Moduswahl "Neues Rezept"/"Neues Lebensmittel" und feuert dafür ein
// window-Event. Dieses Modul hört zu und öffnet den passenden,
// unverändert bestehenden Dialog.
const DETAIL_TITLES = {
  lebensmittel: 'Lebensmittel',
  rezepte:      'Rezepte',
  lexikon:      'Lexikon',
  tipps:        'Tipps',
};

export default function NutritionModule({ view, onNavigateView, hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Suchbegriff aus der Ampel-Fokuskarte, der an AmpelView durchgereicht
  // wird — nur beim Wechsel über die Fokuskarte gesetzt.
  const [ampelSearch, setAmpelSearch] = useState('');

  // Lifted aus RezepteView: undefined = geschlossen, null = neu, Objekt = bearbeiten
  const [editingRecipe, setEditingRecipe] = useState(undefined);
  // Lifted aus AmpelView
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [editingFood, setEditingFood]   = useState(null);
  // Ergebnis eines Mahlzeit-Fotos (null = kein Dialog offen)
  const [mealResult, setMealResult] = useState(null);

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
  // Beide Wege springen zusätzlich in den passenden Bereich, damit der
  // Dialog nicht über einer Übersicht aufgeht, in der er nichts ändert.
  useEffect(() => {
    function openNewRecipe() { setEditingRecipe(null); onNavigateView('rezepte'); }
    function openNewFood()   { setEditingFood(null); setShowFoodForm(true); onNavigateView('lebensmittel'); }
    // Mahlzeit-Foto: Der FAB-Dialog (core/) scannt und schickt das Ergebnis
    // als CustomEvent; der Ergebnisdialog öffnet sich in jeder Ansicht.
    function openMealResult(e) { setMealResult(e.detail || null); }
    window.addEventListener('nutrition:new-recipe', openNewRecipe);
    window.addEventListener('nutrition:new-food', openNewFood);
    window.addEventListener('nutrition:meal-scanned', openMealResult);
    return () => {
      window.removeEventListener('nutrition:new-recipe', openNewRecipe);
      window.removeEventListener('nutrition:new-food', openNewFood);
      window.removeEventListener('nutrition:meal-scanned', openMealResult);
    };
  }, [onNavigateView]);

  function backToOverview() {
    setAmpelSearch('');
    onNavigateView(null);
  }

  function openAmpelWithSearch(query) {
    setAmpelSearch(query);
    onNavigateView('lebensmittel');
  }

  // "Als Lebensmittel speichern" aus dem Mahlzeit-Ergebnis: öffnet das normale
  // Lebensmittel-Formular mit vorbelegten Werten (pro 100 g). Der Nutzer wählt
  // noch die Gruppe und speichert selbst.
  function saveMealAsFood(prefill) {
    setMealResult(null);
    setEditingFood(prefill);
    setShowFoodForm(true);
    onNavigateView('lebensmittel');
  }

  const mealModal = mealResult && (
    <MealScanModal meal={mealResult} onSaveAsFood={saveMealAsFood} onClose={() => setMealResult(null)} />
  );

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

  // ── Detail-Screens: ein Bereich pro Screen ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="nut-module-content with-topbar-space">
          {view === 'lebensmittel' && (
            <AmpelView
              foods={foods}
              currentUserId={session.user.id}
              onSaveFood={handleSaveFood}
              onDeleteFood={handleDeleteFood}
              showForm={showFoodForm}
              setShowForm={setShowFoodForm}
              formFood={editingFood}
              setFormFood={setEditingFood}
              initialSearch={ampelSearch}
            />
          )}

          {view === 'rezepte' && (
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
          )}

          {view === 'lexikon' && <LexikonView />}
          {view === 'tipps'   && <TippsView />}
        </div>
        {mealModal}
      </>
    );
  }

  // ── Übersicht ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="nut-module-content with-topbar-space">
        <OverviewSection
          foods={foods}
          recipes={recipes}
          onSearch={openAmpelWithSearch}
          onNavigate={onNavigateView}
        />
      </div>
      {mealModal}
    </>
  );
}
