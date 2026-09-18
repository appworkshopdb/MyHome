import { getSupabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Aktuellen Verbindungsstatus lesen. RLS erlaubt dem Nutzer nur seine
// eigene Zeile — kein Edge-Function-Aufruf nötig, direkter Select.
export async function getGoogleCalendarStatus(session) {
  const { data, error } = await getSupabase()
    .from('google_calendar_connections')
    .select('google_email, connected_at, last_synced_at, sync_error')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data; // null wenn nicht verbunden
}

// Startet den Connect-Flow: holt die Google-Consent-URL vom Server
// (server-seitig, weil der state-Token dort sicher erzeugt und der
// eingeloggte Nutzer über sein Bearer-Token verifiziert wird) und
// leitet den Browser dorthin weiter. Kehrt nicht zurück (Redirect).
export async function connectGoogleCalendar(session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-connect`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error('Verbindung konnte nicht gestartet werden');
  const { url } = await res.json();
  window.location.href = url;
}

export async function disconnectGoogleCalendar(session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error('Trennen fehlgeschlagen');
}
