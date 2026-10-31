// Suche, Filter und Sortierung der Rezeptliste (reine Funktionen, kein Netzwerk).
//
// Es wird nichts zusätzlich gespeichert: Ernährungsform, Nährwert-Filter und
// Gerichtart werden aus den Zutaten (Lebensmittel-DB), den Nährwerten pro
// Portion und dem Rezeptbild abgeleitet. Gespeichert ist nur die Mahlzeit.

import { resolveCover } from './recipeCovers';

// Umlaute und ß vereinheitlichen, damit "hahnchen", "haehnchen" und "Hähnchen"
// dasselbe finden (Anfrage und Text laufen durch dieselbe Funktion).
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}

// Ernährungsform (einfach wählbar)
export const DIET_FILTERS = [
  { key: 'vegan',   label: 'Vegan',       test: (f) => f.vegan },
  { key: 'veg',     label: 'Vegetarisch', test: (f) => f.vegetarian },
  { key: 'fleisch', label: 'Mit Fleisch', test: (f) => f.meat },
  { key: 'fisch',   label: 'Mit Fisch',   test: (f) => f.fish },
];

// Nährwerte pro Portion (mehrere kombinierbar)
export const NUTRI_FILTERS = [
  { key: 'protein', label: 'Proteinreich',   hint: 'ab 25 g Eiweiß',  test: (f) => f.protein >= 25 },
  { key: 'kcal500', label: 'Unter 500 kcal', hint: 'pro Portion',     test: (f) => f.kcal < 500 },
  { key: 'lowcarb', label: 'Low Carb',       hint: 'bis 30 g KH',     test: (f) => f.carbs <= 30 },
];

// Gerichtart aus dem Rezeptbild (Motiv → Gruppe)
export const ART_GROUPS = [
  { key: 'suppe',  label: 'Suppen & Eintöpfe',   motifs: ['suppe', 'topf'] },
  { key: 'pasta',  label: 'Pasta & Pizza',       motifs: ['pasta', 'pizza'] },
  { key: 'bowl',   label: 'Salate & Bowls',      motifs: ['salat', 'bowl', 'buddha'] },
  { key: 'fleisch', label: 'Fleisch & Fisch',    motifs: ['steak', 'haehnchen', 'fisch', 'steakteller', 'haehnchenteller', 'fischteller', 'burger'] },
  { key: 'pfanne', label: 'Auflauf & Pfanne',    motifs: ['auflauf', 'wok', 'mix', 'reis', 'teller'] },
  { key: 'backen', label: 'Backen & Süßes',      motifs: ['kuchen', 'pfannkuchen', 'eis'] },
  { key: 'snack',  label: 'Snacks & Getränke',   motifs: ['snack', 'smoothie', 'kaffee', 'obst'] },
  { key: 'sonst',  label: 'Sonstiges',           motifs: ['gemuese', 'ei', 'sandwich', 'wrap'] },
];
const ART_BY_MOTIF = Object.fromEntries(ART_GROUPS.flatMap((g) => g.motifs.map((m) => [m, g])));

export const SORTS = [
  { key: 'standard', label: 'Standard' },
  { key: 'name',     label: 'Name A–Z' },
  { key: 'kcal',     label: 'Wenigste kcal' },
  { key: 'protein',  label: 'Meiste Eiweiß' },
];

// Eigenschaften eines Rezepts für Filter und Suche. calc = computeNutrition(...),
// mealLabel = Anzeigename der Mahlzeit. Unbekannte Zutaten (kein Treffer in der
// DB) oder Lebensmittel ohne Ernährungsform machen ein Rezept weder "vegan"
// noch "vegetarisch": lieber nicht in den Filter als falsch darin.
export function recipeFacts(recipe, calc, foodsById, mealLabel = '') {
  const servings = Math.max(1, Number(recipe.servings) || 1);
  let meat = false, fish = false, animalOther = false, veg = false, unknown = false, known = 0;
  const ingredientNames = [];
  const groups = new Set();
  for (const ing of recipe.ingredients || []) {
    const food = foodsById[ing.foodId];
    if (!food) { unknown = true; continue; }
    known += 1;
    ingredientNames.push(food.name);
    groups.add(food.group);
    if (food.group === 'Fleisch & Geflügel') meat = true;
    else if (food.group === 'Fisch & Meeresfrüchte') fish = true;
    else if (food.diet === 'animal') animalOther = true;
    else if (food.diet === 'veg') veg = true;
    else if (food.diet !== 'vegan') unknown = true;
  }
  const vegetarian = known > 0 && !unknown && !meat && !fish && !animalOther;
  const motif = resolveCover(recipe).motif;
  const art = ART_BY_MOTIF[motif.key] || ART_GROUPS[ART_GROUPS.length - 1];

  return {
    kcal: calc.kcal / servings,
    protein: calc.protein / servings,
    carbs: calc.carbs / servings,
    vegan: vegetarian && !veg,
    vegetarian,
    meat,
    fish,
    artKey: art.key,
    servings,
    ingCount: (recipe.ingredients || []).length,
    groups,
    // Suchtexte in drei Gewichten: Name > Zutaten > Rest
    name: normText(recipe.name),
    ingredients: normText(ingredientNames.join(' ')),
    other: normText([
      ...(recipe.customTags || []), ...(recipe.goalTags || []), ...(calc.tags || []),
      recipe.note || '', mealLabel, art.label,
    ].join(' ')),
  };
}

// Alle Wörter der Anfrage müssen irgendwo vorkommen (UND); der Rang richtet sich
// danach, wo: Name 3, Zutat 2, sonst 1. Kein Treffer → null.
export function searchScore(facts, query) {
  const words = normText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let score = 0;
  for (const w of words) {
    if (facts.name.includes(w)) score += 3;
    else if (facts.ingredients.includes(w)) score += 2;
    else if (facts.other.includes(w)) score += 1;
    else return null;
  }
  return score;
}

// items: [{ recipe, facts }] · filters: { query, meal, diet, nutri[], art, sort, newestFirst }
export function applyRecipeFilters(items, { query = '', meal = 'all', diet = null, nutri = [], art = null, sort = 'standard', newestFirst = false }) {
  const dietTest = DIET_FILTERS.find((d) => d.key === diet)?.test;
  const nutriTests = NUTRI_FILTERS.filter((n) => nutri.includes(n.key)).map((n) => n.test);

  let rows = [];
  for (const it of items) {
    if (meal !== 'all' && it.recipe.category !== meal) continue;
    if (dietTest && !dietTest(it.facts)) continue;
    if (nutriTests.some((t) => !t(it.facts))) continue;
    if (art && it.facts.artKey !== art) continue;
    const score = searchScore(it.facts, query);
    if (score === null) continue;
    rows.push({ ...it, score });
  }

  if (newestFirst) rows.reverse(); // Rezepte kommen aufsteigend nach created_at
  const byRelevance = query.trim() && sort === 'standard';
  const cmp = {
    name: (a, b) => a.recipe.name.localeCompare(b.recipe.name, 'de'),
    kcal: (a, b) => a.facts.kcal - b.facts.kcal,
    protein: (a, b) => b.facts.protein - a.facts.protein,
  }[sort];
  if (byRelevance) rows = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.score - a.r.score || a.i - b.i).map((x) => x.r);
  else if (cmp) rows = [...rows].sort(cmp);
  return rows;
}
