import { getSupabase } from '../../../core/lib/supabaseClient';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Trainingseinheiten (spo_workouts)
// ---------------------------------------------------------------------
// Bewusst nur diese eine Tabelle im Zugriff: eine Einheit wird als
// Ganzes erfasst (Datum, Typ, Dauer, Notiz), nicht Satz für Satz.
// spo_entries existiert in der DB weiterhin, wird hier aber nicht
// beschrieben. Eine Einheit kann 'planned' (im Kalender vorausgeplant)
// oder 'done' (abgehakt/direkt eingetragen) sein — der Wechsel läuft
// über setWorkoutStatus().

// Limit großzügig: der Kalender blättert durch Monate und die Auswertung
// rechnet über mehrere Monate — bei 50 Zeilen würden ältere Monate
// unbemerkt leer wirken.
export async function getWorkouts(session, limit = 500) {
  const { data, error } = await getSupabase()
    .from('spo_workouts')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function saveWorkout(session, workout) {
  const payload = {
    ...workout,
    owner_id: ownerId(session),
    // status kommt jetzt vom Aufrufer: 'done' beim direkten Eintragen,
    // 'planned' beim Vorausplanen im Kalender. Der DB-Trigger
    // (spo_workouts_to_measurement) schreibt die Hub-/Auswertungs-
    // Kennzahlen NUR bei 'done' — geplante Einheiten tauchen also
    // korrekterweise noch nicht in der Auswertung auf.
    status: workout.status ?? 'done',
  };
  const { data, error } = await getSupabase().from('spo_workouts').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

// Abhaken/Zurücksetzen direkt aus der Tagesansicht. Der Statuswechsel
// allein genügt — der DB-Trigger legt die measurements-Zeilen an bzw.
// räumt sie beim Zurücksetzen wieder ab (er löscht am Anfang immer
// erst alles zu dieser source_ref_id).
export async function setWorkoutStatus(id, done) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({
      status: done ? 'done' : 'planned',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWorkout(id) {
  // Soft delete, damit Sync zwischen Geräten konsistent bleibt. Der
  // Measurement-Trigger reagiert auf AFTER INSERT OR UPDATE und prüft
  // deleted_at selbst — die zugehörigen measurements-Zeilen werden also
  // automatisch entfernt, sobald deleted_at hier gesetzt wird.
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
