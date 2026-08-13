import { getSupabase } from '../../../core/lib/supabaseClient';
import { SEED_FOODS } from './data/foods';
import { DEFAULT_PROFILE } from './nutrition';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Lebensmittel: Basis ist die statische SEED_FOODS-Liste (gleich für
// alle, kein Sync nötig). "nut_foods" enthält nur, was eine Person
// selbst hinzugefügt oder an einem Seed-Lebensmittel verändert hat.
// Eine Änderung an einem Seed-Eintrag wird als persönliche Kopie mit
// override_of = ursprüngliche Seed-Id gespeichert, statt den globalen
// Datensatz zu verändern.
// ---------------------------------------------------------------------

export async function getCustomFoods(session) {
  const { data, error } = await getSupabase()
    .from('nut_foods')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null);
  if (error) throw error;
  return data;
}

// Führt Seed-Liste + persönliche Overrides/Ergänzungen zu einer Liste
// zusammen, wie sie die Ansicht braucht.
export function mergeFoods(customFoods) {
  const overridesBySeed = new Map();
  const custom = [];
  for (const row of customFoods) {
    if (row.override_of != null) overridesBySeed.set(row.override_of, row);
    else custom.push(row);
  }
  const merged = SEED_FOODS.map((f) => {
    const ov = overridesBySeed.get(f.id);
    return ov ? toFoodShape(ov, f.id) : f;
  });
  return [...merged, ...custom.map((c) => toFoodShape(c))];
}

function toFoodShape(row, seedId) {
  return {
    id: seedId != null ? seedId : row.id,
    _rowId: row.id, // echte DB-Id, für Update/Delete
    _custom: true,
    override_of: row.override_of ?? null,
    name: row.name,
    group: row.food_group,
    category: row.category,
    unit: row.unit,
    kcal: row.kcal, protein: row.protein, carbs: row.carbs, sugar: row.sugar,
    fat: row.fat, satfat: row.satfat, fiber: row.fiber, salt: row.salt,
    vitamins: row.vitamins || [], minerals: row.minerals || [], micros_other: row.micros_other || [],
    allergens: row.allergens || [],
    glutenfrei: row.glutenfrei, laktosefrei: row.laktosefrei,
    tags: row.tags || [], diet: row.diet,
  };
}

// food: Objekt im UI-Format (siehe toFoodShape). Ist food.id eine
// vorhandene Seed-Id (also eine Zahl unter den geladenen Seeds und
// nicht schon _custom), wird es als Override gespeichert.
export async function saveFood(session, food) {
  const isSeedEdit = !food._custom && SEED_FOODS.some((f) => f.id === food.id);
  const overrideOf = isSeedEdit ? food.id : (food._custom ? (food.override_of ?? null) : null);
  const payload = {
    owner_id: ownerId(session),
    override_of: overrideOf,
    name: food.name,
    food_group: food.group,
    category: food.category,
    unit: food.unit,
    kcal: food.kcal, protein: food.protein, carbs: food.carbs, sugar: food.sugar,
    fat: food.fat, satfat: food.satfat, fiber: food.fiber, salt: food.salt,
    vitamins: food.vitamins || [], minerals: food.minerals || [], micros_other: food.micros_other || [],
    allergens: food.allergens || [],
    glutenfrei: !!food.glutenfrei, laktosefrei: !!food.laktosefrei,
    tags: food.tags || [], diet: food.diet,
  };
  if (food._rowId) payload.id = food._rowId;
  const { data, error } = await getSupabase().from('nut_foods').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFood(rowId) {
  const { error } = await getSupabase()
    .from('nut_foods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', rowId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Rezepte
// ---------------------------------------------------------------------

export async function getRecipes(session) {
  const { data, error } = await getSupabase()
    .from('nut_recipes')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(fromRecipeRow);
}

function fromRecipeRow(row) {
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    category: row.category,
    ingredients: row.ingredients || [],
    note: row.note || '',
    customTags: row.custom_tags || [],
    goalTags: row.goal_tags || [],
  };
}

export async function saveRecipe(session, recipe) {
  const payload = {
    owner_id: ownerId(session),
    name: recipe.name,
    servings: recipe.servings,
    category: recipe.category,
    ingredients: recipe.ingredients,
    note: recipe.note || '',
    custom_tags: recipe.customTags || [],
    goal_tags: recipe.goalTags || [],
  };
  if (recipe.id) payload.id = recipe.id;
  const { data, error } = await getSupabase().from('nut_recipes').upsert(payload).select().single();
  if (error) throw error;
  return fromRecipeRow(data);
}

export async function deleteRecipe(id) {
  const { error } = await getSupabase()
    .from('nut_recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Profil (1 Zeile pro Nutzer:in) — enthält seit der body_profile-
// Migration (siehe Projektkontext.md) nur noch die wirklich
// ernährungsspezifischen Felder. Geschlecht/Alter/Größe/Gewicht/
// Aktivität/Ziel kommen jetzt aus core/lib/bodyProfileData.js.
// ---------------------------------------------------------------------

export async function getProfile(session) {
  const { data, error } = await getSupabase()
    .from('nut_profile')
    .select('*')
    .eq('owner_id', ownerId(session))
    .maybeSingle();
  if (error) throw error;
  if (!data) return { diet: DEFAULT_PROFILE.diet, allergies: [] };
  return { diet: data.diet, allergies: data.allergies || [] };
}

export async function saveProfile(session, profile) {
  const payload = { owner_id: ownerId(session), diet: profile.diet, allergies: profile.allergies || [] };
  const { error } = await getSupabase().from('nut_profile').upsert(payload, { onConflict: 'owner_id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Alle Daten löschen (Einstellungen-Analogon zu Finanzen)
// ---------------------------------------------------------------------

export async function deleteAllData(session) {
  const owner = ownerId(session);
  for (const table of ['nut_foods', 'nut_recipes']) {
    const { error } = await getSupabase().from(table).delete().eq('owner_id', owner);
    if (error) throw error;
  }
  const { error } = await getSupabase().from('nut_profile').delete().eq('owner_id', owner);
  if (error) throw error;
}
