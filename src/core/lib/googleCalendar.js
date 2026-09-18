import { getSupabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function getGoogleCalendarStatus(session) {
  const { data, error } = await getSupabase()
    .from('google_calendar_connections')
    .select('google_email, connected_at, last_synced_at, sync_error')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function connectGoogleCalendar(session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-connect`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error('Verbindung konnte nicht gestartet werden');
  const { url } = await res.json();
  window.location.href = url;
}

export async function syncGoogleCalendar(session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Synchronisierung fehlgeschlagen');
  return data;
}

export async function disconnectGoogleCalendar(session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error('Trennen fehlgeschlagen');
}
