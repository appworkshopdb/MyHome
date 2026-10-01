// core/lib/dayPlan.js
// Baut aus den bereits geladenen Hub-Daten den Tagesplan. Reine Funktion,
// kein Netzwerk — Abhaken läuft über die Handler im Hub (eine Wahrheit für
// Todos, Habits und Workouts), der Plan zeigt nur deren Zustand.
//
// Datumsvergleiche per String (YYYY-MM-DD, lokal) — kein toISOString().

import { getSupabase } from './supabaseClient';
import { isDone, todayStr } from './habitsStore.js';

// Gleiche Schreiboperation wie modules/sport/lib/spoData.setWorkoutStatus —
// hier dupliziert, weil core nicht aus modules importieren darf. Beide
// schreiben dieselbe Zeile in spo_workouts, das Sport-Modul sieht den
// Stand beim nächsten Laden (und umgekehrt der Hub beim Öffnen).
export async function setWorkoutDone(id, done) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({ status: done ? 'done' : 'planned', completed_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// Ab/bis wann der Plan als Popup angeboten wird (lokale Stunde)
export const POPUP_FROM_HOUR = 5;
export const POPUP_UNTIL_HOUR = 12;

const OPENED_KEY = 'hub-dayplan-opened';
const DISMISSED_KEY = 'hub-dayplan-dismissed';

export function wasOpenedToday() {
  try { return localStorage.getItem(OPENED_KEY) === todayStr(); } catch { return false; }
}
export function markOpenedToday() {
  try { localStorage.setItem(OPENED_KEY, todayStr()); } catch { /* egal */ }
}
// "×" am Popup: nur für diese Sitzung ausblenden, Plan bleibt später erreichbar
export function wasDismissedThisSession() {
  try { return sessionStorage.getItem(DISMISSED_KEY) === todayStr(); } catch { return false; }
}
export function markDismissedThisSession() {
  try { sessionStorage.setItem(DISMISSED_KEY, todayStr()); } catch { /* egal */ }
}

export function shouldOfferPopup(now = new Date()) {
  const h = now.getHours();
  return h >= POPUP_FROM_HOUR && h < POPUP_UNTIL_HOUR && !wasOpenedToday() && !wasDismissedThisSession();
}

function sportLabel(w) {
  if (w.is_rest) return 'Restday';
  if (w.title) return w.title;
  if (!w.type_key || w.type_key === 'sonstiges') return 'Training';
  const last = w.type_key.split('.').pop();
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// Fremdquellen im Kalender sind schon als Todo/Training im Plan — nur
// Google-Termine kommen dazu, sonst stünde alles doppelt da.
function plainEvents(events) {
  return (events ?? [])
    .filter((e) => e.source_module === 'google')
    .map((e) => ({ id: e.id, title: e.title, time: e.event_time ? e.event_time.slice(0, 5) : null }));
}

export function buildDayPlan({ todos = [], habits = [], habEntries = [], workouts = [], events = [], openPosten = [], today = todayStr() }) {
  // Heute relevante Todos: überfällig, heute fällig oder wichtig ohne Datum.
  // Heute erledigte bleiben sichtbar (durchgestrichen), damit Abhaken nicht
  // sofort Zeilen verschwinden lässt.
  const todayDoneStart = today;
  const relevant = todos.filter((t) => {
    if (t.deleted_at) return false;
    if (t.done) return Boolean(t.done_at) && t.done_at.slice(0, 10) >= todayDoneStart && Boolean(t.due_date ? t.due_date <= today : t.priority);
    return (t.due_date && t.due_date <= today) || (!t.due_date && t.priority);
  });
  const todoItems = relevant
    .map((t) => ({
      id: t.id, title: t.title, done: Boolean(t.done),
      overdue: !t.done && Boolean(t.due_date && t.due_date < today),
      priority: Boolean(t.priority), todo: t,
    }))
    .sort((a, b) => (a.done - b.done) || (b.overdue - a.overdue) || (b.priority - a.priority));

  const workoutItems = workouts
    .filter((w) => !w.is_rest)
    .map((w) => ({ id: w.id, title: sportLabel(w), done: w.status === 'done', minutes: w.duration_min ?? null, workout: w }));
  const restDay = workouts.some((w) => w.is_rest);

  const habitItems = habits.map((h) => ({
    id: h.id, title: h.name, icon: h.icon,
    done: isDone(habEntries, h.id, today, h.target_count), habit: h,
  }));

  const eventItems = plainEvents(events).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const postenSumme = openPosten.reduce((s, p) => s + Number(p.amount || 0), 0);

  const all = [...todoItems, ...workoutItems, ...habitItems];
  return {
    events: eventItems,
    workouts: workoutItems,
    restDay,
    todos: todoItems,
    habits: habitItems,
    posten: { count: openPosten.length, sum: postenSumme },
    total: all.length,
    done: all.filter((i) => i.done).length,
    isEmpty: all.length === 0 && eventItems.length === 0 && !restDay,
  };
}
