import { getSupabase } from './supabaseClient';

// Körperdaten (Geschlecht, Alter, Größe, Gewicht, Aktivität, Ziel) —
// bewusst in core/, nicht in einem Modul: die Daten gehören mehreren
// Modulen (Ernährung, künftig Sport), siehe Projektkontext.md.

// Welche Felder für aussagekräftige Ergebnisse/Statistiken nötig sind.
// Lebt hier (nicht im Ernährungs-Modul), weil body_profile eine
// core-Tabelle ist — jedes Modul, das darauf aufbaut, nutzt dieselbe Spec.
export const BODY_REQUIRED_FIELDS = [
  { key: 'gender', label: 'Geschlecht' },
  { key: 'age', label: 'Alter' },
  { key: 'height', label: 'Größe' },
  { key: 'weight', label: 'Gewicht' },
  { key: 'activity', label: 'Aktivitätslevel' },
  { key: 'goal', label: 'Ziel' },
];

function ownerId(session) {
  return session.user.id;
}

export async function getBodyProfile(session) {
  const { data, error } = await getSupabase()
    .from('body_profile')
    .select('*')
    .eq('owner_id', ownerId(session))
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { gender: null, age: '', height: '', weight: '', activity: null, goal: null };
  }
  return data;
}

export async function saveBodyProfile(session, profile) {
  const payload = {
    owner_id: ownerId(session),
    gender: profile.gender ?? null,
    age: profile.age || null,
    height: profile.height || null,
    weight: profile.weight || null,
    activity: profile.activity ?? null,
    goal: profile.goal ?? null,
  };
  const { error } = await getSupabase().from('body_profile').upsert(payload, { onConflict: 'owner_id' });
  if (error) throw error;
}
