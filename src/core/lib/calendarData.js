import { getSupabase } from './supabaseClient';

// Lädt alle calendar_events für einen Datumsbereich.
// Gibt ein Map<dateString, event[]> zurück — der Hub braucht
// nur einen einfachen Lookup nach Datum.
export async function getCalendarEvents(from, to) {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('*')
    .gte('event_date', from)
    .lte('event_date', to)
    .is('deleted_at', null)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true });
  if (error) throw error;

  // Nach Datum gruppieren
  const map = {};
  for (const ev of data ?? []) {
    if (!map[ev.event_date]) map[ev.event_date] = [];
    map[ev.event_date].push(ev);
  }
  return map;
}
