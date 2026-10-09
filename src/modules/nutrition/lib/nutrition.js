// Reine Berechnungs-/Hilfsfunktionen des Ernährungs-Moduls.
// 1:1 aus der ursprünglichen GoodFood-App übernommen (nur ohne
// localStorage-Anbindung, die läuft jetzt über lib/nutData.js).

export const BASISMAP = { ml: '100 ml', Scheibe: '1 Scheibe', Stück: '1 Stück', Zehe: '1 Zehe', EL: '1 EL' };
export const basis = (unit) => BASISMAP[unit] || '100 g';

export const DEFAULT_PROFILE = {
  name: '',
  gender: 'm',
  age: 30,
  height: 175,
  weight: 75,
  activity: 'moderat',
  goal: 'halten',
  diet: 'alles',
  allergies: [],
};

export const GROUP_COLORS = {
  'Fleisch & Geflügel': '#ef4444',
  'Fisch & Meeresfrüchte': '#3b82f6',
  'Milchprodukte & Eier': '#f59e0b',
  'Getreide & Brot': '#a78bfa',
  Hülsenfrüchte: '#10b981',
  Gemüse: '#22c55e',
  Obst: '#f97316',
  'Nüsse & Samen': '#84cc16',
  'Öle & Fette': '#fbbf24',
  'Snacks & Süßes': '#ec4899',
  Getränke: '#06b6d4',
  Gewürze: '#8b5cf6',
  Sonstiges: '#6b7280',
};

export const AMPEL_CATS = [
  { key: 'erlaubt', label: 'Erlaubt', color: '#16a34a', bg: '#dcfce7' },
  { key: 'okay', label: 'OKAY', color: '#d97706', bg: '#fef3c7' },
  { key: 'tabu', label: 'Tabu', color: '#dc2626', bg: '#fee2e2' },
];

// Vier Mahlzeit-Typen — gelten für Rezepte UND für den Bereich "Mahlzeiten".
// (Früher sieben Rezept-Kategorien: Frühstück, Suppen, Hauptgerichte,
// Desserts, Snacks, Backen, Getränke.)
export const MEAL_TYPES = [
  { key: 'fruehstueck', label: 'Frühstück', emoji: '☀️' },
  { key: 'mittag',      label: 'Mittag',    emoji: '🍽️' },
  { key: 'abend',       label: 'Abend',     emoji: '🌙' },
  { key: 'snack',       label: 'Snack',     emoji: '🥨' },
];

export const RECIPE_CATS = [
  { key: 'all', label: 'Alle', emoji: '🍽️' },
  ...MEAL_TYPES,
];

// Alte Rezept-Kategorien → neue Mahlzeit-Typen. Greift beim Lesen aus der
// Datenbank (nut_recipes.category kann noch alte Werte enthalten) und macht die
// Anzeige unabhängig davon, ob die Daten-Migration schon gelaufen ist.
const LEGACY_RECIPE_CATEGORY = {
  frueh: 'fruehstueck',
  haupt: 'mittag',
  suppen: 'abend',
  desserts: 'snack',
  snacks: 'snack',
  backen: 'snack',
  getraenke: 'snack',
};

export function normalizeRecipeCategory(key) {
  if (MEAL_TYPES.some((t) => t.key === key)) return key;
  return LEGACY_RECIPE_CATEGORY[key] || 'mittag';
}

export const LEX_CATS = [
  { key: 'makro', label: 'Makronährstoffe', color: '#3b82f6' },
  { key: 'vitamine', label: 'Vitamine', color: '#16a34a' },
  { key: 'minerale', label: 'Mineralstoffe', color: '#d97706' },
  { key: 'begriffe', label: 'Ernährungsbegriffe', color: '#8b5cf6' },
];

export const CUSTOM_TAGS = [
  'Proteinreich', 'Fettarm', 'Low Carb', 'Ballaststoffreich',
  'Zuckerarm', 'Kalorienarm', 'Vegan', 'Vegetarisch', 'Omega-3 reich',
];
export const GOAL_TAGS = ['Abnehmen', 'Gewicht halten', 'Zunehmen', 'Muskelaufbau'];

export const TAG_COLORS = {
  Proteinreich: '#2563eb',
  Fettarm: '#16a34a',
  'Low Carb': '#d97706',
  Ballaststoffreich: '#65a30d',
  Zuckerarm: '#db2777',
  Kalorienarm: '#0284c7',
  Vegan: '#059669',
  Vegetarisch: '#0d9488',
  'Omega-3 reich': '#4f46e5',
};

export const TIPP_ICONS = {
  fette: '🥂', zucker: '🍬', darm: '🦠', kombi: '⚗️',
  satt: '🥗', reduzieren: '📉', praxis: '📋',
};

export const fmt = (v, digits = 1) => (v == null || isNaN(v) ? '–' : (+v).toFixed(digits));
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Summiert die Nährwerte einer Zutatenliste (Rezept oder Tagesbilanz)
// anhand der Lebensmittel-Datenbank (foodsById).
export function computeNutrition(ingredients, foodsById) {
  let kcal = 0, protein = 0, carbs = 0, sugar = 0, fat = 0, satfat = 0, fiber = 0, salt = 0;
  const tags = new Set();
  const allergens = new Set();
  let glutenfrei = true;
  let laktosefrei = true;

  for (const ing of ingredients) {
    const food = foodsById[ing.foodId];
    if (!food) continue;
    const amount = ing.amount || 0;
    const factor = ['Scheibe', 'Stück', 'Zehe', 'EL'].includes(food.unit) ? amount : amount / 100;
    kcal += food.kcal * factor;
    protein += food.protein * factor;
    carbs += food.carbs * factor;
    sugar += food.sugar * factor;
    fat += food.fat * factor;
    satfat += food.satfat * factor;
    fiber += food.fiber * factor;
    salt += food.salt * factor;
    (food.tags || []).forEach((t) => tags.add(t));
    (food.allergens || []).forEach((a) => allergens.add(a));
    if (!food.glutenfrei) glutenfrei = false;
    if (!food.laktosefrei) laktosefrei = false;
  }

  return {
    kcal, protein, carbs, sugar, fat, satfat, fiber, salt,
    tags: [...tags],
    allergens: [...allergens],
    glutenfrei, laktosefrei,
  };
}

const ACTIVITY_FACTORS = { sitzend: 1.2, leicht: 1.375, moderat: 1.55, aktiv: 1.725, sehrAktiv: 1.9 };
const GOAL_OFFSETS = { abnehmen: -500, zunehmen: 500, muskel: 250, halten: 0 };

// BMI, Grundumsatz (Mifflin-St Jeor), Tagesbedarf, Kalorien-/Protein-/
// Wasserziel — 1:1 die Original-Formeln aus GoodFood.
export function computeBody(profile) {
  if (!profile.age || !profile.height || !profile.weight) return null;
  const { age, height, weight, gender, activity, goal } = profile;

  const bmi = +(weight / (height / 100) ** 2).toFixed(1);
  const bmiCat = bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas';

  const bmrRaw = gender === 'm'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = Math.round(bmrRaw * (ACTIVITY_FACTORS[activity] || 1.55));
  const target = Math.max(1200, tdee + (GOAL_OFFSETS[goal] || 0));
  const protein = Math.round(weight * (goal === 'muskel' ? 2 : 1.6));
  const water = +(weight * 0.035).toFixed(1);
  const fatG = Math.round((target * 0.3) / 9);
  const carbG = Math.round((target - protein * 4 - fatG * 9) / 4);
  const wMin = +(weight - 2).toFixed(1);
  const wMax = +(23.5 * (height / 100) ** 2).toFixed(1);

  return { bmi, bmiCat, bmr: Math.round(bmrRaw), tdee, target, protein, water, wMin, wMax, fatG, carbG };
}
