// core/lib/weekStats.js
// Wochenrückblick (Hub → Statistiken): Fortschritt der Woche (Mo–So) für
// Gewohnheiten, Sport und Ernährung.
//
// Die build…-Funktionen sind reine Funktionen (kein Netzwerk), loadWeekExtras
// holt Sport, Mahlzeiten und das Kalorienziel. Gewohnheiten und deren Einträge
// kommen aus dem gemeinsamen habitsStore (dieselben Daten wie das Habits-Modul).
//
// Gewohnheiten rechnen über core/lib/habitStatsMath.js — dieselbe Rechnung wie
// die Statistik im Habits-Modul (Pausieren/Löschen ändert die Vergangenheit
// nicht), damit beide Seiten dieselben Quoten zeigen.
//
// Datumslogik ausschließlich mit lokalen Komponenten, nie toISOString()
// (siehe CLAUDE.md). Tage nach "heute" zählen nie mit.

import { getSupabase } from './supabaseClient';
import { getBodyProfile } from './bodyProfileData';
import { computeBody } from './bodyCalc';
import { todayStr } from './habitsStore.js';
import {
  toDateStr, buildDoneIndex, buildEndMap, countHabitRange,
} from './habitStatsMath.js';

// Protein-Ziel gilt an einem Tag als erreicht, wenn mindestens dieser Anteil
// des Tagesziels gegessen wurde.
export const PROTEIN_HIT_RATIO = 0.9;

const MONTH_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// ─── Datum ────────────────────────────────────────────────

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mo = 0
  return addDays(dateStr, -wd);
}

function fmtDay(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}. ${MONTH_ABBR[m - 1]}`;
}

/**
 * Woche (Mo–So) relativ zur aktuellen: offset 0 = diese Woche, -1 = letzte …
 * Liefert start, end, die sieben Tage und eine Beschriftung.
 */
export function weekBounds(offset = 0, today = todayStr()) {
  const start = addDays(mondayOf(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  const label = m1 === m2
    ? `${d1}.–${d2}. ${MONTH_ABBR[m2 - 1]}`
    : `${d1}. ${MONTH_ABBR[m1 - 1]} – ${d2}. ${MONTH_ABBR[m2 - 1]}`;
  return { start, end, days, label, isCurrent: today >= start && today <= end, isFuture: start > today };
}

/** Bis einschließlich heute vergangene Tage der Woche. */
function elapsedDays(week, today) {
  return week.days.filter((d) => d <= today);
}

// ─── Gewohnheiten ─────────────────────────────────────────

/**
 * habits: aktive/pausierte (Store) + archivierte; entries: alle Einträge.
 * prevWeek optional (Vergleich zur Vorwoche).
 */
export function buildHabitsWeek({ habits, entries, week, prevWeek, today = todayStr() }) {
  const doneIdx = buildDoneIndex(entries);
  const endMap = buildEndMap(habits, entries);

  const elapsed = elapsedDays(week, today);
  const cur = countHabitRange(habits, doneIdx, endMap, elapsed);
  // Vergleich mit den gleich vielen Tagen der Vorwoche (wie die Statistik im
  // Habits-Modul: gleich lange Zeiträume) — sonst stünde am Montag ein Tag
  // gegen eine ganze Woche.
  const prev = prevWeek
    ? countHabitRange(habits, doneIdx, endMap, prevWeek.days.slice(0, elapsed.length))
    : { due: 0, done: 0, rate: null };

  const perDay = week.days.map((date) => {
    if (date > today) return { date, rate: null, future: true };
    return { date, rate: countHabitRange(habits, doneIdx, endMap, [date]).rate, future: false };
  });

  // Ranking: nur Gewohnheiten, die in der Woche etwas fällig hatten
  const ranking = habits
    .map((habit) => ({ habit, ...countHabitRange([habit], doneIdx, endMap, elapsed) }))
    .filter((r) => r.due > 0)
    .sort((a, b) => (b.rate - a.rate) || (b.done - a.done));

  return {
    hasData: cur.due > 0,
    rate: cur.rate,
    done: cur.done,
    due: cur.due,
    prevRate: prev.rate,
    perDay,
    ranking,
  };
}

// ─── Sport ────────────────────────────────────────────────

// workouts: Zeilen aus spo_workouts (mindestens occurred_on, status, is_rest,
// duration_min), deckt Woche UND Vorwoche ab.
function sportCounts(workouts, from, to) {
  const inWeek = workouts.filter((w) => w.occurred_on >= from && w.occurred_on <= to);
  const real = inWeek.filter((w) => !w.is_rest);
  const done = real.filter((w) => w.status === 'done');
  return {
    inWeek,
    done: done.length,
    total: real.length,
    minutes: done.reduce((s, w) => s + (w.duration_min || 0), 0),
  };
}

export function buildSportWeek({ workouts, week, prevWeek, today = todayStr() }) {
  const cur = sportCounts(workouts, week.start, week.end);
  const prev = prevWeek ? sportCounts(workouts, prevWeek.start, prevWeek.end) : null;

  const perDay = week.days.map((date) => {
    const list = cur.inWeek.filter((w) => w.occurred_on === date);
    const real = list.filter((w) => !w.is_rest);
    const done = real.filter((w) => w.status === 'done').length;
    return {
      date,
      future: date > today,
      rest: list.some((w) => w.is_rest) && real.length === 0,
      planned: real.length,
      done,
    };
  });

  return {
    hasData: cur.total > 0,
    // Anteil erledigter Einheiten an allen geplanten + absolvierten der Woche
    rate: cur.total > 0 ? cur.done / cur.total : null,
    done: cur.done,
    total: cur.total,
    minutes: cur.minutes,
    prevRate: prev && prev.total > 0 ? prev.done / prev.total : null,
    perDay,
  };
}

// ─── Ernährung ────────────────────────────────────────────

/**
 * meals: Zeilen aus nut_meals der Woche (eaten_on, kcal, protein, is_estimate…)
 * target: Ergebnis von computeBody oder null (Profil unvollständig)
 */
export function buildNutritionWeek({ meals, target, week, today = todayStr() }) {
  const goal = target ? { kcal: target.target, protein: target.protein } : null;
  const elapsed = elapsedDays(week, today);

  const perDay = week.days.map((date) => {
    const list = meals.filter((m) => m.eaten_on === date);
    const kcal = list.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
    const protein = list.reduce((s, m) => s + (Number(m.protein) || 0), 0);
    return {
      date,
      future: date > today,
      logged: list.length > 0,
      kcal,
      protein,
      kcalRatio: goal && goal.kcal > 0 ? kcal / goal.kcal : null,
    };
  });

  const loggedDays = perDay.filter((d) => d.logged && !d.future);
  const avgKcal = loggedDays.length > 0
    ? loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length
    : null;
  const proteinDays = goal && goal.protein > 0
    ? loggedDays.filter((d) => d.protein >= goal.protein * PROTEIN_HIT_RATIO).length
    : null;

  return {
    hasData: loggedDays.length > 0,
    // Fortschritt = an wie vielen der vergangenen Tage Mahlzeiten erfasst wurden
    rate: elapsed.length > 0 ? loggedDays.length / elapsed.length : null,
    loggedDays: loggedDays.length,
    elapsedDays: elapsed.length,
    avgKcal,
    goal,
    proteinDays,
    hasEstimate: meals.some((m) => m.is_estimate),
    perDay,
  };
}

// ─── Gesamt ───────────────────────────────────────────────

/** Mittel der Modul-Quoten, die in der Woche Daten haben (null = nichts da). */
export function overallRate(parts) {
  const rates = parts.filter((p) => p?.hasData && p.rate !== null).map((p) => p.rate);
  if (rates.length === 0) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export function weekHeadline(rate) {
  if (rate === null) return 'Noch keine Daten';
  if (rate >= 0.85) return 'Starke Woche';
  if (rate >= 0.6)  return 'Gute Woche';
  if (rate >= 0.3)  return 'Solide Basis';
  return 'Ruhige Woche';
}

// ─── Laden ────────────────────────────────────────────────

/**
 * Archivierte (gelöschte) Gewohnheiten — wie loadDeletedHabits im Habits-Modul,
 * hier dupliziert, weil core nicht aus modules/ importieren darf. Wer sie in der
 * Statistik ausgeblendet hat (stats_hidden), zählt auch hier nicht.
 */
async function loadArchivedHabits() {
  const { data, error } = await getSupabase()
    .from('hab_habits')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((h) => !h.stats_hidden);
}

/**
 * Sport, Mahlzeiten und Kalorienziel für Woche + Vorwoche.
 * Ein Teil darf ausfallen, ohne die anderen mitzunehmen — der Aufrufer
 * bekommt dann null für den betroffenen Teil.
 */
export async function loadWeekExtras(session, week, prevWeek) {
  const sb = getSupabase();
  const from = prevWeek.start;
  const to = week.end;
  const owner = session.user.id;

  const [archived, workouts, meals, target] = await Promise.all([
    loadArchivedHabits().catch(() => []),
    sb.from('spo_workouts')
      .select('occurred_on, status, is_rest, duration_min')
      .eq('owner_id', owner)
      .is('deleted_at', null)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .then(({ data, error }) => (error ? null : data ?? [])),
    sb.from('nut_meals')
      .select('eaten_on, kcal, protein, is_estimate')
      .eq('owner_id', owner)
      .is('deleted_at', null)
      .gte('eaten_on', week.start)
      .lte('eaten_on', week.end)
      .then(({ data, error }) => (error ? null : data ?? [])),
    // Fehlendes/defektes Profil ist kein Fehler — dann gibt es nur Summen ohne Ziel
    getBodyProfile(session).then((p) => (p ? computeBody(p) : null)).catch(() => null),
  ]);

  return { archived, workouts, meals, target };
}
