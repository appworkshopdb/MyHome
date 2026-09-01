// core/lib/habitsStore.js
// Gemeinsame Datenquelle für Gewohnheiten — genutzt von Hub UND Habits-Modul.
//
// WARUM: Vorher hielten Hub.jsx und HabitsModule.jsx je einen eigenen State.
// Abhaken im Hub war im Modul nicht sichtbar und umgekehrt, weil beide
// unabhängig aus Supabase luden und sich nie gegenseitig informierten.
//
// Dieser Store ist ein einfacher Modul-Level-State mit Subscribe-Mechanismus
// (kein React-Context) — dadurch braucht App.jsx nicht angefasst zu werden.
// Jede Komponente, die useHabitsStore() nutzt, rendert automatisch neu,
// sobald irgendwo ein Habit abgehakt wird.
//
// Architektur-Regel eingehalten: liegt in core/, importiert NICHT aus modules/.

import { useState, useEffect } from 'react';
import { getSupabase } from './supabaseClient.js';

// ─── Interner State ───────────────────────────────────────────

let state = {
  habits:  [],     // alle aktiven, nicht gelöschten Habits
  entries: [],     // ALLE Einträge (nicht nur heute — Modul braucht Historie)
  loaded:  false,
  loading: false,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

// ─── owner_id aus dem JWT lesen ───────────────────────────────
// Analog zum rawAuth-Workaround: kein supabase.auth.getUser(),
// stattdessen Token selbst dekodieren.
function getOwnerIdFromToken() {
  try {
    const token = JSON.parse(localStorage.getItem('zuhause_session') || '{}').access_token;
    if (!token) throw new Error('Kein Token');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    throw new Error('Nicht eingeloggt oder Token ungültig');
  }
}

// ─── Hilfsfunktionen (Fälligkeit / Erledigt-Status) ───────────

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Ist der Habit an diesem Datum fällig?
export function isDueOn(habit, dateStr) {
  if (!habit.active || habit.deleted_at) return false;
  const created = new Date(habit.created_at).toISOString().split('T')[0];
  if (created > dateStr) return false;
  const wd = (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7; // 0 = Montag
  if (habit.frequency === 'daily')    return true;
  if (habit.frequency === 'weekdays') return wd < 5;
  if (habit.frequency === 'custom' && Array.isArray(habit.frequency_days)) {
    return habit.frequency_days.includes(wd);
  }
  return true;
}

// Eintrag für Habit an einem Datum finden
export function getEntry(entries, habitId, dateStr) {
  return entries.find(
    (e) => e.habit_id === habitId && e.logged_on === dateStr && !e.deleted_at
  );
}

// Ist der Habit an diesem Datum erledigt?
export function isDone(entries, habitId, dateStr, targetCount = 1) {
  const entry = getEntry(entries, habitId, dateStr);
  return !!entry && entry.count >= targetCount;
}

// Heute fällige Habits, erledigte nach unten sortiert
export function getDueToday(habits, entries) {
  const d = todayStr();
  return habits
    .filter((h) => isDueOn(h, d))
    .sort((a, b) => {
      const aDone = isDone(entries, a.id, d, a.target_count) ? 1 : 0;
      const bDone = isDone(entries, b.id, d, b.target_count) ? 1 : 0;
      return aDone - bDone;
    });
}

// ─── Laden ────────────────────────────────────────────────────

export async function loadHabitsData({ force = false } = {}) {
  if (state.loading) return;
  if (state.loaded && !force) return;
  setState({ loading: true });
  try {
    const sb = getSupabase();
    const [habRes, entRes] = await Promise.all([
      sb.from('hab_habits')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      sb.from('hab_entries')
        .select('*')
        .is('deleted_at', null)
        .order('logged_on', { ascending: false }),
    ]);
    if (habRes.error) throw habRes.error;
    if (entRes.error) throw entRes.error;
    setState({
      habits:  habRes.data ?? [],
      entries: entRes.data ?? [],
      loaded:  true,
      loading: false,
    });
  } catch (e) {
    console.error('[habitsStore] Laden fehlgeschlagen:', e);
    setState({ loading: false });
    throw e;
  }
}

// Nur die Einträge neu laden (nach externen Änderungen)
export async function reloadEntries() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hab_entries')
      .select('*')
      .is('deleted_at', null)
      .order('logged_on', { ascending: false });
    if (error) throw error;
    setState({ entries: data ?? [] });
  } catch (e) {
    console.error('[habitsStore] Einträge neu laden fehlgeschlagen:', e);
  }
}

// Nur die Habit-Definitionen neu laden (nach Anlegen/Bearbeiten/Löschen)
export async function reloadHabits() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hab_habits')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    setState({ habits: data ?? [] });
  } catch (e) {
    console.error('[habitsStore] Habits neu laden fehlgeschlagen:', e);
  }
}

// ─── Abhaken / Rückgängig (die eine Wahrheit) ─────────────────
//
// Optimistisch: State wird sofort aktualisiert, alle Abonnenten
// (Hub UND Modul) rendern neu. Danach wird persistiert. Schlägt das
// fehl, wird der alte State wiederhergestellt.

export async function toggleHabitOn(habit, dateStr = todayStr()) {
  const sb     = getSupabase();
  const target = habit.target_count ?? 1;
  const before = state.entries;

  // WICHTIG: state.entries enthält nur nicht-gelöschte Zeilen (siehe loadHabitsData).
  // Für die Insert/Update-Entscheidung muss aber auch eine evtl. bereits
  // vorhandene, soft-gelöschte Zeile berücksichtigt werden — sonst schlägt
  // der Insert mit 409 Conflict gegen die Unique-Constraint fehl (Habit
  // wurde früher schon mal an/aus geschaltet).
  const { data: existing, error: findErr } = await sb
    .from('hab_entries')
    .select('*')
    .eq('habit_id', habit.id)
    .eq('logged_on', dateStr)
    .maybeSingle();
  if (findErr) throw findErr;

  const wasDone = !!existing && !existing.deleted_at && existing.count >= target;

  // 1) Optimistisch updaten — sofort sichtbar in Hub und Modul
  let optimistic;
  if (wasDone) {
    optimistic = before.filter((e) => e.id !== existing.id);
  } else if (existing) {
    optimistic = before.map((e) =>
      e.id === existing.id ? { ...e, deleted_at: null, count: target } : e
    );
  } else {
    optimistic = [
      ...before,
      { id: `tmp-${habit.id}-${dateStr}`, habit_id: habit.id, logged_on: dateStr, count: target, deleted_at: null },
    ];
  }
  setState({ entries: optimistic });

  // 2) Persistieren
  try {
    if (existing) {
      if (wasDone) {
        const { error } = await sb
          .from('hab_entries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('hab_entries')
          .update({ deleted_at: null, count: target })
          .eq('id', existing.id);
        if (error) throw error;
      }
    } else {
      // WICHTIG: owner_id muss mit — sonst schlägt die RLS-Prüfung fehl
      const owner_id = getOwnerIdFromToken();
      const { data, error } = await sb
        .from('hab_entries')
        .insert({ owner_id, habit_id: habit.id, logged_on: dateStr, count: target })
        .select()
        .single();
      if (error) throw error;
      // Temporäre ID durch die echte ersetzen
      if (data) {
        setState({
          entries: state.entries.map((e) =>
            e.id === `tmp-${habit.id}-${dateStr}` ? data : e
          ),
        });
      }
    }
    return { done: !wasDone };
  } catch (e) {
    console.error('[habitsStore] Toggle fehlgeschlagen:', e);
    setState({ entries: before }); // zurückrollen
    throw e;
  }
}

// Zähler setzen (für Habits mit target_count > 1)
export async function setHabitCount(habit, count, dateStr = todayStr()) {
  const sb     = getSupabase();
  const before = state.entries;

  // Wie in toggleHabitOn: auch soft-gelöschte Zeilen berücksichtigen,
  // sonst 409 Conflict beim Insert gegen die Unique-Constraint.
  const { data: existing, error: findErr } = await sb
    .from('hab_entries')
    .select('id, deleted_at')
    .eq('habit_id', habit.id)
    .eq('logged_on', dateStr)
    .maybeSingle();
  if (findErr) throw findErr;

  let optimistic;
  if (count <= 0) {
    optimistic = before.filter((e) => !(e.habit_id === habit.id && e.logged_on === dateStr));
  } else if (existing) {
    optimistic = before.map((e) =>
      e.id === existing.id ? { ...e, count, deleted_at: null } : e
    );
  } else {
    optimistic = [
      ...before,
      { id: `tmp-${habit.id}-${dateStr}`, habit_id: habit.id, logged_on: dateStr, count, deleted_at: null },
    ];
  }
  setState({ entries: optimistic });

  try {
    if (count <= 0) {
      if (existing) {
        const { error } = await sb
          .from('hab_entries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      }
    } else if (existing) {
      const { error } = await sb
        .from('hab_entries')
        .update({ count, deleted_at: null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const owner_id = getOwnerIdFromToken();
      const { data, error } = await sb
        .from('hab_entries')
        .insert({ owner_id, habit_id: habit.id, logged_on: dateStr, count })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setState({
          entries: state.entries.map((e) =>
            e.id === `tmp-${habit.id}-${dateStr}` ? data : e
          ),
        });
      }
    }
  } catch (e) {
    console.error('[habitsStore] setHabitCount fehlgeschlagen:', e);
    setState({ entries: before });
    throw e;
  }
}

// ─── React-Hook ───────────────────────────────────────────────
// Jede Komponente, die diesen Hook nutzt, rendert automatisch neu,
// sobald der Store sich ändert — egal von wo aus.

export function useHabitsStore() {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    const listener = (next) => setSnapshot(next);
    listeners.add(listener);
    setSnapshot(state); // aktuellen Stand direkt übernehmen
    // Beim ersten Mounten laden, falls noch nie geladen
    if (!state.loaded && !state.loading) {
      loadHabitsData().catch(() => { /* Fehler wird im Store geloggt */ });
    }
    return () => listeners.delete(listener);
  }, []);

  return snapshot;
}
