import { getSupabase } from '../../../core/lib/supabaseClient';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Trainingseinheiten (spo_workouts)
// ---------------------------------------------------------------------
// Bewusst nur diese eine Tabelle im Zugriff: eine Einheit wird als
// Ganzes erfasst (Datum, Typ, Dauer, Notiz), nicht Satz für Satz.
// spo_entries existiert in der DB weiterhin, wird hier aber (noch)
// nicht beschrieben — direktes Eintragen setzt status sofort auf
// 'done', ohne einen 'active'-Zwischenzustand zu durchlaufen.

export async function getWorkouts(session, limit = 50) {
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
    // Direktes Eintragen: es gibt keinen Start/Stop-Zustand, die Einheit
    // ist beim Speichern bereits abgeschlossen. Der DB-Trigger
    // (spo_workouts_to_measurement) übernimmt daraufhin automatisch die
    // Hub-Kennzahlen (sport.session, sport.duration).
    status: 'done',
  };
  const { data, error } = await getSupabase().from('spo_workouts').upsert(payload).select().single();
  if (error) throw error;
  return data;
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
