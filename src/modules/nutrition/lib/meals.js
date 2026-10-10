// Reine Hilfsfunktionen für den Bereich "Mahlzeiten" (kein Netzwerk).
//
// Grundregel: Ein gespeicherter Mahlzeit-Eintrag ist eine MOMENTAUFNAHME. Die
// Nährwerte werden beim Speichern kopiert und nicht aus Rezept oder Lebensmittel
// nachgeschlagen — sonst würde sich der Verlauf ändern, wenn später ein Rezept
// bearbeitet oder gelöscht wird.

import { MEAL_TYPES } from './nutrition';

// Lebensmittel, deren Nährwerte pro 100 g/ml gelten (nur diese lassen sich im
// Mahlzeit-Scan über Gramm umrechnen; "Stück", "EL" usw. gelten pro Einheit).
export function isGramFood(f) {
  return !!f && (f.unit === 'g' || f.unit === 'ml');
}

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'];

// ── Datum: immer lokale Komponenten, nie toISOString() (siehe CLAUDE.md) ──────
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "Heute" / "Gestern" / "Morgen" / "Mo., 5. Okt."
export function formatDayLabel(dateStr, today = todayStr()) {
  if (dateStr === today) return 'Heute';
  if (dateStr === shiftDate(today, -1)) return 'Gestern';
  if (dateStr === shiftDate(today, 1)) return 'Morgen';
  return parseDate(dateStr).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Vorschlag für den Mahlzeit-Typ nach Uhrzeit (änderbar)
export function defaultMealType(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10.5) return 'fruehstueck';
  if (h < 14.5) return 'mittag';
  if (h < 17) return 'snack';
  if (h < 21) return 'abend';
  return 'snack';
}

export function mealTypeInfo(key) {
  return MEAL_TYPES.find((t) => t.key === key) || MEAL_TYPES[3];
}

// ── Rundung ──────────────────────────────────────────────────────────────────
const round = (v, digits = 0) => {
  const f = 10 ** digits;
  return Math.round((+v || 0) * f) / f;
};

function roundNutrients(n) {
  return {
    kcal: round(n.kcal), protein: round(n.protein, 1), carbs: round(n.carbs, 1), sugar: round(n.sugar, 1),
    fat: round(n.fat, 1), satfat: round(n.satfat, 1), fiber: round(n.fiber, 1), salt: round(n.salt, 2),
  };
}

// ── Momentaufnahmen ──────────────────────────────────────────────────────────

// scan: { name, items: [{name, grams, kcal, protein, …}] } — items bereits mit den
// vom Nutzer korrigierten Gramm umgerechnet. kcalLow/kcalHigh: Spanne der ganzen Mahlzeit.
// items[].src: 'db' (Nährwerte aus der Lebensmittel-Datenbank), 'ai' (KI-Schätzung)
// oder 'user' (vom Nutzer aus der Datenbank hinzugefügt); wird mitgespeichert.
// isEstimate: false nur, wenn nichts davon geschätzt ist (alles vom Nutzer gewählt).
export function mealFromScan({ name, items, kcalLow, kcalHigh, isEstimate = true }, { mealType, eatenOn }) {
  const total = { kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satfat: 0, fiber: 0, salt: 0 };
  for (const it of items) for (const k of NUTRIENT_KEYS) total[k] += it[k] || 0;
  const t = roundNutrients(total);
  return {
    eatenOn,
    mealType,
    name: name || 'Mahlzeit',
    source: 'scan',
    recipeId: null,
    servings: null,
    isEstimate,
    ...t,
    kcalLow: kcalLow != null ? Math.min(round(kcalLow), t.kcal) : null,
    kcalHigh: kcalHigh != null ? Math.max(round(kcalHigh), t.kcal) : null,
    items: items.map((i) => ({ name: i.name, amount: round(i.grams), unit: 'g', kcal: round(i.kcal), ...(i.src ? { src: i.src } : {}) })),
    note: null,
  };
}

// recipe: Rezept-Objekt, calc: computeNutrition() über ALLE Portionen des Rezepts,
// portions: gegessene Portionen, foodsById: für die Namen der Zutaten.
export function mealFromRecipe(recipe, calc, portions, foodsById, { mealType, eatenOn }) {
  const servings = recipe.servings || 1;
  const factor = portions / servings;
  const scaled = {};
  for (const k of NUTRIENT_KEYS) scaled[k] = (calc[k] || 0) * factor;
  const t = roundNutrients(scaled);
  return {
    eatenOn,
    mealType,
    name: recipe.name,
    source: 'recipe',
    recipeId: typeof recipe.id === 'string' ? recipe.id : null, // nur Hinweis, kein Fremdschlüssel
    servings: portions,
    isEstimate: false,
    ...t,
    kcalLow: null,
    kcalHigh: null,
    items: (recipe.ingredients || []).map((ing) => {
      const food = foodsById[ing.foodId];
      return { name: food?.name || 'Zutat', amount: round((ing.amount || 0) * factor, 1), unit: food?.unit || 'g' };
    }),
    note: null,
  };
}

// ── Summen ───────────────────────────────────────────────────────────────────
// Tagessumme über mehrere Einträge. estimatedKcal = Anteil aus Schätzungen (Foto).
export function sumMeals(meals) {
  const t = { kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satfat: 0, fiber: 0, salt: 0, estimatedKcal: 0, count: meals.length };
  for (const m of meals) {
    for (const k of NUTRIENT_KEYS) t[k] += m[k] || 0;
    if (m.isEstimate) t.estimatedKcal += m.kcal || 0;
  }
  return t;
}

const UNIT_SHORT = { g: 'g', ml: 'ml', Stück: 'Stk.', Scheibe: 'Sch.', EL: 'EL', Zehe: 'Zehe' };
export function formatAmount(item) {
  return `${item.amount} ${UNIT_SHORT[item.unit] || item.unit || 'g'}`;
}
