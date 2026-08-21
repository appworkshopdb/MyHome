// modules/habits/lib/habData.js
// Alle Supabase-Zugriffe für das Gewohnheiten-Modul

import { getSupabase } from '../../../core/lib/supabaseClient.js';

// ─── Habits (Definitionen) ─────────────────────────────────

export async function loadHabits() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('hab_habits')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveHabit(habit) {
  const sb = getSupabase();
  if (habit.id) {
    // Update
    const { data, error } = await sb
      .from('hab_habits')
      .update({
        name:           habit.name,
        description:    habit.description ?? null,
        category:       habit.category,
        icon:           habit.icon,
        frequency:      habit.frequency,
        frequency_days: habit.frequency_days ?? null,
        target_count:   habit.target_count ?? 1,
        unit:           habit.unit ?? null,
        reminder_time:  habit.reminder_time ?? null,
        active:         habit.active ?? true,
        sort_order:     habit.sort_order ?? 0,
      })
      .eq('id', habit.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Insert
    const { data, error } = await sb
      .from('hab_habits')
      .insert({
        name:           habit.name,
        description:    habit.description ?? null,
        category:       habit.category,
        icon:           habit.icon,
        frequency:      habit.frequency ?? 'daily',
        frequency_days: habit.frequency_days ?? null,
        target_count:   habit.target_count ?? 1,
        unit:           habit.unit ?? null,
        reminder_time:  habit.reminder_time ?? null,
        active:         true,
        sort_order:     habit.sort_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteHabit(habitId) {
  const sb = getSupabase();
  // Soft Delete
  const { error } = await sb
    .from('hab_habits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', habitId);
  if (error) throw error;
}

export async function toggleHabitActive(habitId, active) {
  const sb = getSupabase();
  const { error } = await sb
    .from('hab_habits')
    .update({ active })
    .eq('id', habitId);
  if (error) throw error;
}

// ─── Entries (Check-ins) ───────────────────────────────────

/**
 * Lädt alle Entries für einen Zeitraum.
 * @param {string} from  ISO-Datum (YYYY-MM-DD)
 * @param {string} to    ISO-Datum (YYYY-MM-DD)
 */
export async function loadEntries(from, to) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('hab_entries')
    .select('*')
    .is('deleted_at', null)
    .gte('logged_on', from)
    .lte('logged_on', to);
  if (error) throw error;
  return data ?? [];
}

/**
 * Lädt alle Entries (ohne Zeitraum-Filter) für Streaks/Heatmap.
 */
export async function loadAllEntries() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('hab_entries')
    .select('*')
    .is('deleted_at', null)
    .order('logged_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Habit abhaken (togglen): existiert bereits → Soft-Delete; fehlt → Insert.
 * Für Count-Habits: count wird gesetzt (nicht getoggelt).
 */
export async function toggleEntry(habitId, date, countValue = 1) {
  const sb = getSupabase();
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  // Existing entry suchen (inkl. soft-deleted)
  const { data: existing, error: fetchErr } = await sb
    .from('hab_entries')
    .select('*')
    .eq('habit_id', habitId)
    .eq('logged_on', dateStr)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  if (existing && existing.deleted_at === null) {
    // Bereits erledigt → rückgängig (Soft Delete)
    const { error } = await sb
      .from('hab_entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    return null;
  } else if (existing && existing.deleted_at !== null) {
    // War soft-deleted → wiederherstellen
    const { data, error } = await sb
      .from('hab_entries')
      .update({ deleted_at: null, count: countValue })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Neu einfügen
    const { data, error } = await sb
      .from('hab_entries')
      .insert({
        habit_id:  habitId,
        logged_on: dateStr,
        count:     countValue,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Count-Habit: Zähler direkt setzen (z.B. 3 von 8 Gläsern).
 */
export async function setEntryCount(habitId, date, count) {
  const sb = getSupabase();
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  if (count <= 0) {
    // Auf 0 → Entry entfernen
    const { error } = await sb
      .from('hab_entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('habit_id', habitId)
      .eq('logged_on', dateStr)
      .is('deleted_at', null);
    if (error) throw error;
    return null;
  }

  const { data: existing } = await sb
    .from('hab_entries')
    .select('id, deleted_at')
    .eq('habit_id', habitId)
    .eq('logged_on', dateStr)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from('hab_entries')
      .update({ count, deleted_at: null })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb
      .from('hab_entries')
      .insert({ habit_id: habitId, logged_on: dateStr, count })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
