import { useCallback, useEffect, useState } from 'react';
import './nutrition.css';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile, BODY_REQUIRED_FIELDS } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import ModuleTabs from '../../core/components/ModuleTabs';
import AmpelView from './components/AmpelView';
import RezepteView from './components/RezepteView';
import LexikonView from './components/LexikonView';
import TippsView from './components/TippsView';
import * as db from './lib/nutData';

// Meldet sich beim zentralen, modulunabhängigen Pflichtdaten-Register an
// (core/lib/requiredDataRegistry.js) — läuft einmalig beim ersten Import
// dieser Datei, unabhängig davon, ob der Hub oder das Modul gerade
// angezeigt wird. Der Hub kennt dadurch "Ernährung" nicht direkt.
// Körperdaten (body_profile) gehören core, nicht dem Ernährungs-Modul —
// die Lücke wird deshalb unter dem Key "profile" gemeldet (dort ist auch
// das Formular), nicht unter "nutrition". Sport meldet sich mit einer
// eigenen Spec unter demselben Key an — beide werden im Register
// automatisch zusammengeführt (siehe core/lib/requiredDataRegistry.js).
// Bleibt unverändert bestehen, obwohl der Ernährungs-eigene Profil-Tab
// entfernt wurde — die Warnung führt jetzt einfach direkt zur
// gemeinsamen Profil-Seite statt zu einem modul-eigenen Tab.
registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(BODY_REQUIRED_FIELDS, body);
});

// Profil ist raus (siehe Projektkontext.md) — Ernährungsform + BMI-
// Ergebnis leben jetzt auf der gemeinsamen Profil-Seite
// (core/Profile.jsx), Körperdaten sowieso schon länger dort.
const VIEW_TITLES = {
  rezepte: 'Rezepte',
  ampel:   'Ampel',
  lexikon: 'Lexikon',
  tipps:   'Tipps',
};
const DEFAULT_VIEW = 'rezepte';
const TABS = Object.entries(VIEW_TITLES).map(([key, label]) => ({ key, label }));

// Das Ernährungs-Modul in seiner Gesamtheit. Lädt die persönlichen Daten
// (eigene Lebensmittel-Ergänzungen, Rezepte) einmalig aus Supabase und
// reicht sie an die vier Unteransichten weiter.
// view/onNavigateView kommen von App.jsx (URL-Routing) — kein eigener
// useState für die Unteransicht mehr, siehe FinanceModule.jsx/Projektkontext.md.
export default function NutritionModule({ view, onNavigateView, hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const activeView = VIEW_TITLES[view] ? view : DEFAULT_VIEW;
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="loading-note">Lädt…</div>;

  return (
    <>
      <ModuleTopBar title={VIEW_TITLES[activeView]} hasWarnings={hasWarnings} />
      <ModuleTabs items={TABS} active={activeView} onChange={onNavigateView} />
      {activeView === 'ampel' && (
        <AmpelView foods={foods} currentUserId={session.user.id} onSaveFood={handleSaveFood} onDeleteFood={handleDeleteFood} />
      )}
      {activeView === 'rezepte' && (
        <RezepteView
          foods={foods}
          recipes={recipes}
          currentUserId={session.user.id}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          showToast={showToast}
        />
      )}
      {activeView === 'lexikon' && <LexikonView />}
      {activeView === 'tipps' && <TippsView />}
    </>
  );
}
