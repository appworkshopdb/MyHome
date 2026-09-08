// Ernährungsform + Allergien (Tabelle nut_profile, Spalten diet/allergies).
// Liegt hier in core, nicht im Ernährungs-Modul, weil die Bearbeitung
// jetzt auf der gemeinsamen Profil-Seite (Profile.jsx) passiert und
// core/ nicht aus modules/* importieren darf. Die Tabelle bleibt
// nut_profile — nur der Zugriffscode ist umgezogen.
//
// modules/nutrition/lib/nutData.js hat getProfile()/saveProfile() mit
// identischer Funktion noch für sich stehen — seit der Profil-Tab dort
// entfernt wurde, ist das dort ungenutzter Code. Kann bei Gelegenheit
// aufgeräumt werden, ist aber nicht dringend (kein Konflikt, greift auf
// dieselbe Tabelle zu).
import { getSupabase } from './supabaseClient';

const DEFAULT_DIET_PROFILE = { diet: 'alles', allergies: [] };

export async function getDietProfile(session) {
  const { data, error } = await getSupabase()
    .from('nut_profile')
    .select('diet, allergies')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_DIET_PROFILE };
  return { diet: data.diet || DEFAULT_DIET_PROFILE.diet, allergies: data.allergies || [] };
}

export async function saveDietProfile(session, { diet, allergies }) {
  const payload = { owner_id: session.user.id, diet, allergies: allergies || [] };
  const { error } = await getSupabase().from('nut_profile').upsert(payload, { onConflict: 'owner_id' });
  if (error) throw error;
}
