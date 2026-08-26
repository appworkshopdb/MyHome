import { getSupabase } from './supabaseClient';
import { getBodyProfile, saveBodyProfile } from './bodyProfileData';

// Gewichtsverlauf — bewusst in core/, nicht in einem Modul (siehe
// Migrations-Kommentar): body_profile.weight bleibt der "aktuelle
// Wert", diese Tabelle ist die Historie dahinter. Beide werden hier
// synchron gehalten, damit Module, die weiterhin nur body_profile.weight
// lesen (z.B. Ernährung für Kalorienberechnung), automatisch den
// neuesten geloggten Wert sehen, ohne selbst etwas ändern zu müssen.

function ownerId(session) {
  return session.user.id;
}

export async function getWeightLogs(session) {
  const { data, error } = await getSupabase()
    .from('body_weight_logs')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('logged_on', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addWeightLog(session, { logged_on, weight }) {
  const { data, error } = await getSupabase()
    .from('body_weight_logs')
    .insert({ owner_id: ownerId(session), logged_on, weight })
    .select()
    .single();
  if (error) throw error;

  // body_profile.weight nur aktualisieren, wenn der neue Eintrag der
  // chronologisch neueste ist — sonst würde ein nachträglich
  // eingetragener alter Wert den "aktuellen" Wert fälschlich
  // überschreiben.
  const logs = await getWeightLogs(session);
  const latest = logs[logs.length - 1];
  if (latest && latest.id === data.id) {
    const profile = await getBodyProfile(session);
    await saveBodyProfile(session, { ...profile, weight: String(weight) });
  }

  return data;
}

export async function deleteWeightLog(session, id) {
  const { error } = await getSupabase()
    .from('body_weight_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  // War der gelöschte Eintrag der aktuellste, body_profile.weight auf
  // den neuen letzten verbleibenden Wert zurücksetzen. Bleiben keine
  // Einträge mehr übrig, wird body_profile.weight bewusst NICHT
  // geleert — die Person könnte den Wert weiterhin manuell im Profil
  // pflegen wollen.
  const logs = await getWeightLogs(session);
  const latest = logs[logs.length - 1];
  if (latest) {
    const profile = await getBodyProfile(session);
    if (String(profile.weight) !== String(latest.weight)) {
      await saveBodyProfile(session, { ...profile, weight: String(latest.weight) });
    }
  }
}
