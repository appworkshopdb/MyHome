// Supabase Edge Function "google-calendar-sync"
// =====================================================================
// Läuft per pg_cron alle 2 Stunden (siehe Migration weiter unten) für
// ALLE verbundenen Nutzer. Holt pro Nutzer frische Google-Calendar-
// Termine und schreibt sie in calendar_events (source_module='google'),
// erkannt/aktualisiert über google_event_id. Termine die bei Google
// nicht mehr im Zeitfenster auftauchen (gelöscht/verschoben) werden
// weich gelöscht.
//
// Fenster: heute -7 Tage bis heute +60 Tage — großzügig genug für
// Hub-Wochenansicht und künftige Erweiterungen, ohne die ganze
// Kalender-Historie zu synchronisieren.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

const supabase = createClient(supabaseUrl, serviceRoleKey);

const WINDOW_DAYS_PAST = 7;
const WINDOW_DAYS_FUTURE = 60;

// Access-Token aus dem gespeicherten Refresh-Token erneuern.
// Wirft bei invalid_grant (Nutzer hat den Zugriff bei Google widerrufen).
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId!,
      client_secret: googleClientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const revoked = data.error === 'invalid_grant';
    throw new Error(revoked ? 'REVOKED' : `Token-Refresh fehlgeschlagen: ${data.error}`);
  }
  return data.access_token as string;
}

// Google Calendar Events im Fenster holen. singleEvents=true expandiert
// wiederkehrende Termine zu einzelnen Instanzen mit echtem Datum.
async function fetchGoogleEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendar-API-Fehler: ${data.error?.message ?? res.status}`);
  return data.items ?? [];
}

async function syncOneUser(connection: {
  owner_id: string;
  refresh_token_secret_id: string;
  calendar_id: string;
}) {
  const { owner_id: ownerId, refresh_token_secret_id: secretId, calendar_id: calendarId } = connection;

  const { data: refreshToken, error: tokenErr } = await supabase.rpc('get_google_refresh_token', {
    p_secret_id: secretId,
  });
  if (tokenErr || !refreshToken) throw new Error('Refresh-Token nicht lesbar');

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(refreshToken);
  } catch (err) {
    if (err.message === 'REVOKED') {
      await supabase
        .from('google_calendar_connections')
        .update({ sync_error: 'Zugriff wurde bei Google widerrufen — bitte erneut verbinden.' })
        .eq('owner_id', ownerId);
      return { ownerId, status: 'revoked' };
    }
    throw err;
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - WINDOW_DAYS_PAST * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86400000).toISOString();
  const windowStartDate = timeMin.slice(0, 10);
  const windowEndDate = timeMax.slice(0, 10);

  const items = await fetchGoogleEvents(accessToken, calendarId, timeMin, timeMax);

  const seenIds: string[] = [];
  const rows = [];
  for (const item of items) {
    if (item.status === 'cancelled' || !item.id) continue;
    const isAllDay = !!item.start?.date;
    const eventDate = isAllDay ? item.start.date : item.start?.dateTime?.slice(0, 10);
    if (!eventDate) continue;
    const eventTime = isAllDay ? null : item.start.dateTime.slice(11, 19);

    // Ende — analog zum Start geparst. Bei ganztägigen Terminen liefert
    // Google end.date bereits als "exklusiv" (Tag NACH dem letzten Tag,
    // iCal-Konvention) — für die Anzeige subtrahieren wir hier bewusst
    // NICHT einen Tag, das würde bei mehrtägigen Terminen mehr
    // Sonderfälle schaffen, als es für v1 wert ist.
    const eventDateEnd = isAllDay ? item.end?.date : item.end?.dateTime?.slice(0, 10);
    const eventTimeEnd = isAllDay ? null : item.end?.dateTime?.slice(11, 19);

    // Erinnerung: nur wenn das Event eine EIGENE Erinnerung hat
    // (useDefault === false). Bei useDefault === true kennen wir die
    // tatsächliche Minutenzahl nicht ohne einen zusätzlichen Aufruf der
    // Kalender-Einstellungen — für v1 bewusst weggelassen, dann bleibt
    // reminder_minutes einfach null.
    let reminderMinutes: number | null = null;
    if (item.reminders?.useDefault === false && Array.isArray(item.reminders.overrides) && item.reminders.overrides.length > 0) {
      reminderMinutes = Math.min(...item.reminders.overrides.map((o: { minutes: number }) => o.minutes));
    }

    seenIds.push(item.id);
    rows.push({
      owner_id: ownerId,
      event_date: eventDate,
      event_time: eventTime,
      event_date_end: eventDateEnd ?? null,
      event_time_end: eventTimeEnd ?? null,
      source_module: 'google',
      source_ref_id: crypto.randomUUID(),
      google_event_id: item.id,
      title: item.summary || '(Ohne Titel)',
      description: item.description ?? null,
      location: item.location ?? null,
      status: item.status ?? null,
      reminder_minutes: reminderMinutes,
      done: false,
      deleted_at: null,
    });
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('calendar_events')
      .upsert(rows, { onConflict: 'owner_id,google_event_id' });
    if (upsertErr) throw upsertErr;
  }

  // Termine im Fenster, die bei Google nicht mehr auftauchen → weich löschen
  let cleanupQuery = supabase
    .from('calendar_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
    .eq('source_module', 'google')
    .not('google_event_id', 'is', null)
    .gte('event_date', windowStartDate)
    .lte('event_date', windowEndDate)
    .is('deleted_at', null);

  if (seenIds.length > 0) {
    cleanupQuery = cleanupQuery.not('google_event_id', 'in', `(${seenIds.map((id) => `"${id}"`).join(',')})`);
  }
  await cleanupQuery;

  await supabase
    .from('google_calendar_connections')
    .update({ last_synced_at: new Date().toISOString(), sync_error: null })
    .eq('owner_id', ownerId);

  return { ownerId, status: 'ok', count: rows.length };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const testOwnerId = url.searchParams.get('test_owner');

  let connQuery = supabase
    .from('google_calendar_connections')
    .select('owner_id, refresh_token_secret_id, calendar_id');
  if (testOwnerId) connQuery = connQuery.eq('owner_id', testOwnerId);
  const { data: connections } = await connQuery;

  const results = [];
  for (const conn of connections ?? []) {
    try {
      results.push(await syncOneUser(conn));
    } catch (err) {
      console.error('[google-calendar-sync] Fehler für', conn.owner_id, err);
      results.push({ ownerId: conn.owner_id, status: 'error', message: err.message });
    }
  }

  return new Response(JSON.stringify({ synced: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
