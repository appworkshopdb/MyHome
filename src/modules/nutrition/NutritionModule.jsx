import { useCallback, useEffect, useState } from 'react';
import './nutrition.css';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import ModuleTabs from '../../core/components/ModuleTabs';
import AmpelView from './components/AmpelView';
import RezepteView from './components/RezepteView';
import LexikonView from './components/LexikonView';
import TippsView from './components/TippsView';
import ProfilView from './components/ProfilView';
import * as db from './lib/nutData';
import { DEFAULT_PROFILE } from './lib/nutrition';

// Meldet sich beim zentralen, modulunabhängigen Pflichtdaten-Register an
// (core/lib/requiredDataRegistry.js) — läuft einmalig beim ersten Import
// dieser Datei, unabhängig davon, ob der Hub oder das Modul gerade
// angezeigt wird. Der Hub kennt dadurch "Ernährung" nicht direkt.
registerRequirement('nutrition', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(BODY_REQUIRED_FIELDS, body);
});

const VIEW_TITLES = {
  ampel: 'Ernährungsampel',
  rezepte: 'Rezepte',
  lexikon: 'Ernährungslexikon',
  tipps: 'Tipps',
  profil: 'Profil',
};
const DEFAULT_VIEW = 'ampel';
const TABS = Object.entries(VIEW_TITLES).map(([key, label]) => ({ key, label }));

// Das Ernährungs-Modul in seiner Gesamtheit. Lädt die persönlichen Daten
// (eigene Lebensmittel-Ergänzungen, Rezepte, Profil) einmalig aus
// Supabase und reicht sie an die fünf Unteransichten weiter — inhaltlich
// identisch zur ursprünglichen GoodFood-App, nur ohne eigenen Login und
// ohne eigenes Supabase-Projekt.
// view/onNavigateView kommen von App.jsx (URL-Routing) — kein eigener
// useState für die Unteransicht mehr, siehe FinanceModule.jsx/Projektkontext.md.
export default function NutritionModule({ view, onNavigateView }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const activeView = VIEW_TITLES[view] ? view : DEFAULT_VIEW;
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [customFoods, recipeRows, bodyProfile, nutProfile] = await Promise.all([
        db.getCustomFoods(session),
        db.getRecipes(session),
        getBodyProfile(session),
        db.getProfile(session),
      ]);
      setFoods(db.mergeFoods(customFoods));
      setRecipes(recipeRows);
      setProfile({ ...DEFAULT_PROFILE, ...bodyProfile, ...nutProfile });
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

  // Körperdaten (core, geteilt mit z.B. Sport) und Ernährungs-spezifische
  // Felder (diet/allergies, nut_profile) getrennt speichern, dem UI aber
  // weiterhin als ein zusammengeführtes Profil-Objekt zeigen.
  async function handleSaveProfile(next) {
    setProfile(next);
    const { gender, age, height, weight, activity, goal, diet, allergies } = next;
    await Promise.all([
      saveBodyProfile(session, { gender, age, height, weight, activity, goal }),
      db.saveProfile(session, { diet, allergies }),
    ]);
  }

  if (loading) return <div className="loading-note">Lädt…</div>;

  return (
    <>
      <ModuleTopBar title={VIEW_TITLES[activeView]} />
      <ModuleTabs items={TABS} active={activeView} onChange={onNavigateView} />
      {activeView === 'ampel' && (
        <AmpelView foods={foods} onSaveFood={handleSaveFood} onDeleteFood={handleDeleteFood} />
      )}
      {activeView === 'rezepte' && (
        <RezepteView
          foods={foods}
          recipes={recipes}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          showToast={showToast}
        />
      )}
      {activeView === 'lexikon' && <LexikonView />}
      {activeView === 'tipps' && <TippsView />}
      {activeView === 'profil' && (
        <ProfilView profile={profile} onSaveProfile={handleSaveProfile} email={session.user.email} />
      )}
    </>
  );
}
