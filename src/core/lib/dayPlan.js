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

// Posten im Tagesplan als bezahlt markieren — gleiche Zeile/Spalte wie
// finData.togglePaid im Finanzen-Modul (core darf nicht aus modules importieren).
export async function setEntryPaid(id, paid) {
  const { error } = await getSupabase().from('fin_entries').update({ paid }).eq('id', id);
  if (error) throw error;
}

export function sportLabel(w) {
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
  // Offene Posten gehören nur dann in den Tagesplan, wenn ihnen ein
  // Fälligkeitsdatum gesetzt ist und es heute erreicht (oder überschritten)
  // ist — "irgendwie offen im Monat" ist kein Tagesthema.
  const postenItems = openPosten
    .filter((p) => !p.paid && p.due_date && p.due_date <= today)
    .map((p) => ({ id: p.id, title: p.name, amount: Number(p.amount || 0), overdue: p.due_date < today }))
    .sort((a, b) => (b.overdue - a.overdue) || (b.amount - a.amount));

  const all = [...todoItems, ...workoutItems, ...habitItems];
  return {
    events: eventItems,
    workouts: workoutItems,
    restDay,
    todos: todoItems,
    habits: habitItems,
    posten: postenItems,
    total: all.length,
    done: all.filter((i) => i.done).length,
    isEmpty: all.length === 0 && eventItems.length === 0 && postenItems.length === 0 && !restDay,
  };
}
