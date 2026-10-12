// core/lib/periodStats.js
// Wochen- und Monatsüberblick (Hub → Statistiken): Fortschritt eines Zeitraums
// für Gewohnheiten, Sport und Ernährung.
//
// Ein Zeitraum ("period") ist eine Woche (Mo–So) oder ein Kalendermonat, siehe
// weekBounds/monthBounds. Er bringt `columns` mit — die Spalten der kleinen
// Verlaufsgrafik: bei der Woche ein Tag je Spalte, beim Monat eine Kalenderwoche
// (Mo–So, am Monatsrand gekürzt) je Spalte.
//
// Die build…-Funktionen sind reine Funktionen (kein Netzwerk), loadPeriodExtras
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
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Datum ────────────────────────────────────────────────

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

function weekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7; // Mo = 0
}

function mondayOf(dateStr) {
  return addDays(dateStr, -weekdayIndex(dateStr));
}

function dayOfMonth(dateStr) {
  return Number(dateStr.split('-')[2]);
}

/** Zeitraum-Rahmen: Start, Ende, alle Tage, Spalten, Beschriftung, "läuft noch". */
function finishPeriod(kind, days, label, columns, today) {
  const start = days[0];
  const end = days[days.length - 1];
  return { kind, start, end, days, label, columns, isCurrent: today >= start && today <= end };
}

/**
 * Woche (Mo–So) relativ zur aktuellen: offset 0 = diese Woche, -1 = letzte …
 * Spalten: ein Tag je Spalte, beschriftet mit dem Wochentag.
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
  const columns = days.map((d) => ({ key: d, label: WD[weekdayIndex(d)], days: [d] }));
  return finishPeriod('week', days, label, columns, today);
}

/**
 * Kalendermonat relativ zum aktuellen: offset 0 = dieser Monat, -1 = letzter …
 * Spalten: Kalenderwochen (Mo–So, am Monatsrand gekürzt), beschriftet mit dem
 * Tagesbereich ("5.–11.").
 */
export function monthBounds(offset = 0, today = todayStr()) {
  const [y, m] = today.split('-').map(Number);
  const first = new Date(y, m - 1 + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const length = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length }, (_, i) => toDateStr(new Date(year, month, i + 1)));

  const columns = [];
  let cur = [];
  for (const d of days) {
    if (weekdayIndex(d) === 0 && cur.length > 0) { columns.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length > 0) columns.push(cur);

  return finishPeriod(
    'month',
    days,
    `${MONTH_NAMES[month]} ${year}`,
    columns.map((ds) => ({
      key: ds[0],
      label: ds.length === 1 ? `${dayOfMonth(ds[0])}.` : `${dayOfMonth(ds[0])}.–${dayOfMonth(ds[ds.length - 1])}.`,
      days: ds,
    })),
    today,
  );
}

export function periodBounds(kind, offset = 0, today = todayStr()) {
  return kind === 'month' ? monthBounds(offset, today) : weekBounds(offset, today);
}

/** Bis einschließlich heute vergangene Tage. */
function elapsedDays(days, today) {
  return days.filter((d) => d <= today);
}

// ─── Gewohnheiten ─────────────────────────────────────────

/**
 * habits: aktive/pausierte (Store) + archivierte; entries: alle Einträge.
 * prevPeriod optional (Vergleich zum Zeitraum davor).
 */
export function buildHabitsPeriod({ habits, entries, period, prevPeriod, today = todayStr() }) {
  const doneIdx = buildDoneIndex(entries);
  const endMap = buildEndMap(habits, entries);

  const elapsed = elapsedDays(period.days, today);
  const cur = countHabitRange(habits, doneIdx, endMap, elapsed);
  // Vergleich mit den gleich vielen Tagen des Zeitraums davor (wie die
  // Statistik im Habits-Modul: gleich lange Zeiträume) — sonst stünde am
  // Montag ein Tag gegen eine ganze Woche.
  const prev = prevPeriod
    ? countHabitRange(habits, doneIdx, endMap, prevPeriod.days.slice(0, elapsed.length))
    : { due: 0, done: 0, rate: null };

  const cols = period.columns.map((c) => {
    const ds = elapsedDays(c.days, today);
    if (ds.length === 0) return { key: c.key, label: c.label, future: true, rate: null };
    return { key: c.key, label: c.label, future: false, rate: countHabitRange(habits, doneIdx, endMap, ds).rate };
  });

  // Ranking: nur Gewohnheiten, die im Zeitraum etwas fällig hatten
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
    cols,
    ranking,
  };
}

// ─── Sport ────────────────────────────────────────────────

// workouts: Zeilen aus spo_workouts (mindestens occurred_on, status, is_rest,
// duration_min), deckt Zeitraum UND Zeitraum davor ab.
function sportCounts(workouts, from, to) {
  const inRange = workouts.filter((w) => w.occurred_on >= from && w.occurred_on <= to);
  const real = inRange.filter((w) => !w.is_rest);
  const done = real.filter((w) => w.status === 'done');
  return {
    inRange,
    done: done.length,
    total: real.length,
    minutes: done.reduce((s, w) => s + (w.duration_min || 0), 0),
  };
}

export function buildSportPeriod({ workouts, period, prevPeriod, today = todayStr() }) {
  const cur = sportCounts(workouts, period.start, period.end);
  const prev = prevPeriod ? sportCounts(workouts, prevPeriod.start, prevPeriod.end) : null;

  const cols = period.columns.map((c) => {
    const list = cur.inRange.filter((w) => c.days.includes(w.occurred_on));
    const real = list.filter((w) => !w.is_rest);
    return {
      key: c.key,
      label: c.label,
      future: c.days[0] > today,
      rest: list.some((w) => w.is_rest) && real.length === 0,
      planned: real.length,
      done: real.filter((w) => w.status === 'done').length,
    };
  });

  return {
    hasData: cur.total > 0,
    // Anteil erledigter Einheiten an allen geplanten + absolvierten des Zeitraums
    rate: cur.total > 0 ? cur.done / cur.total : null,
    done: cur.done,
    total: cur.total,
    minutes: cur.minutes,
    prevRate: prev && prev.total > 0 ? prev.done / prev.total : null,
    cols,
  };
}

// ─── Ernährung ────────────────────────────────────────────

/**
 * meals: Zeilen aus nut_meals des Zeitraums (eaten_on, kcal, protein, is_estimate…)
 * target: Ergebnis von computeBody oder null (Profil unvollständig)
 */
export function buildNutritionPeriod({ meals, target, period, today = todayStr() }) {
  const goal = target ? { kcal: target.target, protein: target.protein } : null;
  const elapsed = elapsedDays(period.days, today);

  const perDay = period.days.map((date) => {
    const list = meals.filter((m) => m.eaten_on === date);
    return {
      date,
      future: date > today,
      logged: list.length > 0,
      kcal: list.reduce((s, m) => s + (Number(m.kcal) || 0), 0),
      protein: list.reduce((s, m) => s + (Number(m.protein) || 0), 0),
    };
  });
  const dayByDate = new Map(perDay.map((d) => [d.date, d]));

  const cols = period.columns.map((c) => {
    const ds = c.days.map((d) => dayByDate.get(d));
    const passed = ds.filter((d) => !d.future);
    const loggedDays = passed.filter((d) => d.logged).length;
    const first = ds[0];
    return {
      key: c.key,
      label: c.label,
      future: passed.length === 0,
      loggedDays,
      elapsedDays: passed.length,
      // Tageswerte nur bei Ein-Tages-Spalten (Wochenansicht) sinnvoll
      kcalRatio: ds.length === 1 && goal && goal.kcal > 0 ? first.kcal / goal.kcal : null,
      logged: ds.length === 1 ? first.logged : loggedDays > 0,
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
    cols,
  };
}

// ─── Gesamt ───────────────────────────────────────────────

/** Mittel der Modul-Quoten, die im Zeitraum Daten haben (null = nichts da). */
export function overallRate(parts) {
  const rates = parts.filter((p) => p?.hasData && p.rate !== null).map((p) => p.rate);
  if (rates.length === 0) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export function periodHeadline(rate, kind = 'week') {
  const month = kind === 'month';
  if (rate === null) return 'Noch keine Daten';
  if (rate >= 0.85) return month ? 'Starker Monat' : 'Starke Woche';
  if (rate >= 0.6)  return month ? 'Guter Monat' : 'Gute Woche';
  if (rate >= 0.3)  return 'Solide Basis';
  return month ? 'Ruhiger Monat' : 'Ruhige Woche';
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
 * Sport, Mahlzeiten und Kalorienziel für Zeitraum + Zeitraum davor.
 * Ein Teil darf ausfallen, ohne die anderen mitzunehmen — der Aufrufer
 * bekommt dann null für den betroffenen Teil.
 */
export async function loadPeriodExtras(session, period, prevPeriod) {
  const sb = getSupabase();
  const owner = session.user.id;

  const [archived, workouts, meals, target] = await Promise.all([
    loadArchivedHabits().catch(() => []),
    sb.from('spo_workouts')
      .select('occurred_on, status, is_rest, duration_min')
      .eq('owner_id', owner)
      .is('deleted_at', null)
      .gte('occurred_on', prevPeriod.start)
      .lte('occurred_on', period.end)
      .then(({ data, error }) => (error ? null : data ?? [])),
    sb.from('nut_meals')
      .select('eaten_on, kcal, protein, is_estimate')
      .eq('owner_id', owner)
      .is('deleted_at', null)
      .gte('eaten_on', period.start)
      .lte('eaten_on', period.end)
      .then(({ data, error }) => (error ? null : data ?? [])),
    // Fehlendes/defektes Profil ist kein Fehler — dann gibt es nur Summen ohne Ziel
    getBodyProfile(session).then((p) => (p ? computeBody(p) : null)).catch(() => null),
  ]);

  return { archived, workouts, meals, target };
}
