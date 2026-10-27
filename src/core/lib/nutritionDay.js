// core/lib/nutritionDay.js
// Ernährungsstand des heutigen Tages für den Tagesplan (Hub).
//
// Liegt in core/, weil der Hub nicht aus modules/nutrition importieren darf.
// Liest dieselben Tabellen wie das Ernährungsmodul: nut_meals (nur eigene
// Zeilen, RLS) und body_profile → Tagesziel über computeBody. Die Mahlzeit-
// Typen sind hier bewusst dupliziert (Quelle: MEAL_TYPES in
// modules/nutrition/lib/nutrition.js).
//
// buildNutritionDay ist eine reine Funktion (kein Netzwerk) und damit
// testbar; loadNutritionDay holt die Daten. Datum immer lokal (todayStr aus
// habitsStore, nie toISOString — siehe CLAUDE.md).

import { getSupabase } from './supabaseClient';
import { getBodyProfile } from './bodyProfileData';
import { computeBody } from './bodyCalc';
import { todayStr } from './habitsStore.js';

export const DAY_MEAL_TYPES = [
  { key: 'fruehstueck', label: 'Frühstück', emoji: '☀️' },
  { key: 'mittag',      label: 'Mittag',    emoji: '🍽️' },
  { key: 'abend',       label: 'Abend',     emoji: '🌙' },
  { key: 'snack',       label: 'Snack',     emoji: '🥨' },
];

// Wie MealsView/defaultMealType: welche Mahlzeit ist zu dieser Uhrzeit "dran"?
export function currentMealType(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10.5) return 'fruehstueck';
  if (h < 14.5) return 'mittag';
  if (h < 17) return 'snack';
  if (h < 21) return 'abend';
  return 'snack';
}

const num = (v) => Number(v) || 0;

// meals: Zeilen aus nut_meals (snake_case) · target: Ergebnis von computeBody oder null
export function buildNutritionDay({ meals = [], target = null, now = new Date() }) {
  const eaten = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const logged = new Set();
  let hasEstimate = false;
  for (const m of meals) {
    eaten.kcal += num(m.kcal);
    eaten.protein += num(m.protein);
    eaten.carbs += num(m.carbs);
    eaten.fat += num(m.fat);
    logged.add(m.meal_type);
    if (m.is_estimate) hasEstimate = true;
  }

  const goal = target
    ? { kcal: target.target, protein: target.protein, carbs: target.carbG, fat: target.fatG }
    : null;

  // offen = Ziel − gegessen (nie negativ); pct = Anteil des Ziels, auf 0–100 begrenzt
  const part = (key) => {
    if (!goal || !(goal[key] > 0)) return null;
    return {
      eaten: eaten[key],
      goal: goal[key],
      open: Math.max(0, goal[key] - eaten[key]),
      pct: Math.min(100, Math.max(0, (eaten[key] / goal[key]) * 100)),
    };
  };

  const nowType = currentMealType(now);
  return {
    count: meals.length,
    hasEstimate,
    eaten,
    goal,
    kcal: part('kcal'),
    macros: { protein: part('protein'), carbs: part('carbs'), fat: part('fat') },
    overKcal: goal ? Math.max(0, Math.round(eaten.kcal - goal.kcal)) : 0,
    slots: DAY_MEAL_TYPES.map((t) => ({
      ...t,
      logged: logged.has(t.key),
      next: !logged.has(t.key) && t.key === nowType,
    })),
  };
}

const COLS = 'meal_type, kcal, protein, carbs, fat, is_estimate';

export async function loadNutritionDay(session, today = todayStr()) {
  const [mealsRes, profile] = await Promise.all([
    getSupabase()
      .from('nut_meals')
      .select(COLS)
      .eq('owner_id', session.user.id)
      .is('deleted_at', null)
      .eq('eaten_on', today),
    // Fehlendes/defektes Profil ist kein Fehler — dann gibt es nur Summen ohne Ziel
    getBodyProfile(session).catch(() => null),
  ]);
  if (mealsRes.error) throw mealsRes.error;
  return buildNutritionDay({ meals: mealsRes.data ?? [], target: profile ? computeBody(profile) : null });
}
