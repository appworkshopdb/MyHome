import { useCallback, useEffect, useState } from 'react';
import './nutrition.css';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import BottomNav from './components/BottomNav';
import AmpelView from './components/AmpelView';
import RezepteView from './components/RezepteView';
import LexikonView from './components/LexikonView';
import TippsView from './components/TippsView';
import ProfilView from './components/ProfilView';
import * as db from './lib/nutData';
import { DEFAULT_PROFILE } from './lib/nutrition';

const VIEW_TITLES = {
  ampel: 'Ernährungsampel',
  rezepte: 'Rezepte',
  lexikon: 'Ernährungslexikon',
  tipps: 'Tipps',
  profil: 'Profil',
};

// Das Ernährungs-Modul in seiner Gesamtheit. Lädt die persönlichen Daten
// (eigene Lebensmittel-Ergänzungen, Rezepte, Profil) einmalig aus
// Supabase und reicht sie an die fünf Unteransichten weiter — inhaltlich
// identisch zur ursprünglichen GoodFood-App, nur ohne eigenen Login und
// ohne eigenes Supabase-Projekt.
export default function NutritionModule() {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [view, setView] = useState('ampel');
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [customFoods, recipeRows, profileRow] = await Promise.all([
        db.getCustomFoods(session),
        db.getRecipes(session),
        db.getProfile(session),
      ]);
      setFoods(db.mergeFoods(customFoods));
      setRecipes(recipeRows);
      setProfile(profileRow);
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

  async function handleSaveProfile(next) {
    setProfile(next);
    await db.saveProfile(session, next);
  }

  if (loading) return <div className="loading-note">Lädt…</div>;

  return (
    <>
      <div className="page-header"><h1>{VIEW_TITLES[view]}</h1></div>
      {view === 'ampel' && (
        <AmpelView foods={foods} onSaveFood={handleSaveFood} onDeleteFood={handleDeleteFood} />
      )}
      {view === 'rezepte' && (
        <RezepteView
          foods={foods}
          recipes={recipes}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          showToast={showToast}
        />
      )}
      {view === 'lexikon' && <LexikonView />}
      {view === 'tipps' && <TippsView />}
      {view === 'profil' && (
        <ProfilView profile={profile} onSaveProfile={handleSaveProfile} email={session.user.email} />
      )}
      <BottomNav active={view} onChange={setView} />
    </>
  );
}
