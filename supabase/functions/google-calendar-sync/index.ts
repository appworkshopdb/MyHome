// Google Calendar → app calendar synchronization.
// Imports core fields plus reminder defaults/override minutes.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);
const WINDOW_DAYS_PAST = 7;
const WINDOW_DAYS_FUTURE = 60;

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: googleClientId, client_secret: googleClientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error === 'invalid_grant' ? 'REVOKED' : `Token-Refresh fehlgeschlagen: ${data.error}`);
  return data.access_token as string;
}

async function fetchGoogleEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string) {
  const all: any[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '2500' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Calendar-API-Fehler: ${data.error?.message ?? res.status}`);
    all.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

async function syncOneUser(connection: { owner_id: string; refresh_token_secret_id: string }) {
  const { owner_id: ownerId, refresh_token_secret_id: secretId } = connection;
  const { data: refreshToken, error: tokenErr } = await supabase.rpc('get_google_refresh_token', { p_secret_id: secretId });
  if (tokenErr || !refreshToken) throw new Error('Refresh-Token nicht lesbar');

  let accessToken: string;
  try { accessToken = await refreshAccessToken(refreshToken); }
  catch (err) {
    if (err instanceof Error && err.message === 'REVOKED') {
      await supabase.from('google_calendar_connections').update({ sync_error: 'Zugriff wurde bei Google widerrufen — bitte erneut verbinden.' }).eq('owner_id', ownerId);
      return { ownerId, status: 'revoked' };
    }
    throw err;
  }

  // Welche Kalender soll dieser Nutzer synchronisiert bekommen?
  // (per Auswahl-UI abwählbar, siehe google_calendars.sync_enabled)
  const { data: calendars, error: calErr } = await supabase
    .from('google_calendars')
    .select('google_calendar_id')
    .eq('owner_id', ownerId)
    .eq('sync_enabled', true);
  if (calErr) throw calErr;

  // Fallback fuer Verbindungen von vor dem Mehrfach-Kalender-Umbau, bei
  // denen google_calendars noch leer ist -- mindestens "primary" syncen.
  const calendarIds = (calendars ?? []).map((c) => c.google_calendar_id);
  if (calendarIds.length === 0) calendarIds.push('primary');

  const now = new Date();
  const timeMin = new Date(now.getTime() - WINDOW_DAYS_PAST * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86400000).toISOString();
  const windowStartDate = timeMin.slice(0, 10);
  const windowEndDate = timeMax.slice(0, 10);

  let totalCount = 0;

  for (const calendarId of calendarIds) {
    const items = await fetchGoogleEvents(accessToken, calendarId, timeMin, timeMax);
    const seenIds: string[] = [];
    const rows: any[] = [];

    for (const item of items) {
      if (!item.id) continue;
      const isAllDay = !!item.start?.date;
      const startDate = isAllDay ? item.start.date : item.start?.dateTime?.slice(0, 10);
      if (!startDate) continue;
      const startDateTime = isAllDay ? null : item.start.dateTime;
      const startTime = isAllDay ? null : item.start.dateTime.slice(11, 19);
      const endDate = isAllDay ? (item.end?.date ?? null) : (item.end?.dateTime?.slice(0, 10) ?? null);
      const endDateTime = isAllDay ? null : (item.end?.dateTime ?? null);
      const endTime = isAllDay ? null : (item.end?.dateTime?.slice(11, 19) ?? null);
      const useDefault = item.reminders?.useDefault ?? null;
      const overrides = Array.isArray(item.reminders?.overrides) ? item.reminders.overrides.map((o: { minutes: number }) => o.minutes).filter((m: unknown) => Number.isFinite(m)) : [];
      const reminderMinutes = overrides.length ? Math.min(...overrides) : null;

      seenIds.push(item.id);
      rows.push({
        owner_id: ownerId, event_date: startDate, event_time: startTime, event_date_end: endDate, event_time_end: endTime,
        source_module: 'google', source_ref_id: crypto.randomUUID(), google_event_id: item.id, google_calendar_id: calendarId,
        title: item.summary || '(Ohne Titel)', description: item.description ?? null, location: item.location ?? null,
        status: item.status ?? null, done: false, reminder_minutes: reminderMinutes,
        deleted_at: item.status === 'cancelled' ? new Date().toISOString() : null,
        google_start_date: isAllDay ? startDate : null, google_start_datetime: startDateTime, google_start_timezone: item.start?.timeZone ?? null,
        google_end_date: isAllDay ? endDate : null, google_end_datetime: endDateTime, google_end_timezone: item.end?.timeZone ?? null,
        reminder_use_default: useDefault, reminder_overrides_minutes: overrides,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await supabase.from('calendar_events').upsert(rows, { onConflict: 'owner_id,google_calendar_id,google_event_id' });
      if (error) throw error;
    }

    // Aufraeumen -- NUR innerhalb dieses einen Kalenders, damit ein Sync-
    // Lauf fuer "Termine" nicht versehentlich Eintraege aus "Klassenarbeiten"
    // loescht, die in diesem Durchlauf gar nicht abgefragt wurden.
    let cleanupQuery = supabase.from('calendar_events').update({ deleted_at: new Date().toISOString() })
      .eq('owner_id', ownerId).eq('source_module', 'google').eq('google_calendar_id', calendarId).not('google_event_id', 'is', null)
      .gte('event_date', windowStartDate).lte('event_date', windowEndDate).is('deleted_at', null);
    if (seenIds.length) cleanupQuery = cleanupQuery.not('google_event_id', 'in', `(${seenIds.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(',')})`);
    const { error: cleanupError } = await cleanupQuery;
    if (cleanupError) throw cleanupError;

    totalCount += rows.length;
  }

  await supabase.from('google_calendar_connections').update({ last_synced_at: new Date().toISOString(), sync_error: null }).eq('owner_id', ownerId);
  return { ownerId, status: 'ok', count: totalCount, calendars: calendarIds.length };
}

async function getRequestOwner(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Unauthorized');
  if (auth === `Bearer ${serviceRoleKey}`) return null; // internal all-user sync
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: serviceRoleKey } });
  if (!res.ok) throw new Error('Unauthorized');
  const user = await res.json();
  if (!user?.id) throw new Error('Unauthorized');
  return user.id as string;
}

Deno.serve(async (req) => {
  try {
    const requestOwner = await getRequestOwner(req);
    const url = new URL(req.url);
    const requestedOwner = url.searchParams.get('test_owner');
    // A normal user may only sync their own connection. The service role may
    // sync all connections or a selected test_owner.
    if (requestOwner && requestedOwner && requestedOwner !== requestOwner) throw new Error('Forbidden');
    const ownerFilter = requestOwner || requestedOwner;

    let query = supabase.from('google_calendar_connections').select('owner_id, refresh_token_secret_id');
    if (ownerFilter) query = query.eq('owner_id', ownerFilter);
    const { data: connections, error } = await query;
    if (error) throw error;

    const results = [];
    for (const conn of connections ?? []) {
      try { results.push(await syncOneUser(conn)); }
      catch (err) { console.error('[google-calendar-sync]', conn.owner_id, err); results.push({ ownerId: conn.owner_id, status: 'error', message: err instanceof Error ? err.message : 'unknown_error' }); }
    }
    return new Response(JSON.stringify({ synced: results.length, results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Fehler' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
});
