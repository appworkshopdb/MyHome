import { getSupabase } from './supabaseClient';
import { addDaysStr, diffDays } from './calendarUtils';

const MAX_SPAN_DAYS = 62; // Schutz gegen kaputte Enddaten

// Letzter Tag (inklusive) eines Termins. Google-Ganztagstermine haben ein
// EXKLUSIVES Enddatum (Termin am 5. endet laut Google am 6.) — daher -1.
function lastDay(ev) {
  if (!ev.event_date_end || ev.event_date_end <= ev.event_date) return ev.event_date;
  const googleAllDay = ev.source_module === 'google' && !ev.event_time;
  const end = googleAllDay ? addDaysStr(ev.event_date_end, -1) : ev.event_date_end;
  return end < ev.event_date ? ev.event_date : end;
}

// Verteilt einen Termin auf alle Tage, die er berührt (nur innerhalb von
// from..to). Jede Kopie trägt _day, _dayIndex und _spanLen.
function expandMultiDay(ev, from, to) {
  const last = lastDay(ev);
  const spanLen = Math.min(diffDays(ev.event_date, last) + 1, MAX_SPAN_DAYS);
  const out = [];
  for (let i = 0; i < spanLen; i++) {
    const day = addDaysStr(ev.event_date, i);
    if (day < from) continue;
    if (day > to) break;
    out.push({ ...ev, _day: day, _dayIndex: i, _spanLen: spanLen });
  }
  return out;
}

// Lädt alle calendar_events, die den Zeitraum berühren (auch Termine, die
// davor beginnen und hineinreichen). Gibt Map<dateString, event[]> zurück.
export async function getCalendarEvents(from, to) {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('*')
    .lte('event_date', to)
    .or(`event_date.gte.${from},event_date_end.gte.${from}`)
    .is('deleted_at', null)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true });
  if (error) throw error;

  const map = {};
  for (const ev of data ?? []) {
    // Todos kommen live aus der todos-Tabelle (siehe todoToEvent).
    if (ev.source_module === 'todo') continue;
    for (const inst of expandMultiDay(ev, from, to)) {
      (map[inst._day] ??= []).push(inst);
    }
  }
  return map;
}
