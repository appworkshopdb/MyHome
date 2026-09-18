// Google Calendar OAuth callback.
// Exchanges the authorization code, stores the refresh token in Vault,
// creates the user's connection and immediately starts the first sync.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const functionsPublicUrl = Deno.env.get('FUNCTIONS_PUBLIC_URL')!;
const appPublicUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://staging.nestua.de';
const supabase = createClient(supabaseUrl, serviceRoleKey);

function redirect(path: string) {
  return Response.redirect(`${appPublicUrl.replace(/\/$/, '')}${path}`, 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return redirect(`/?google_calendar=error&reason=${encodeURIComponent(error)}`);
  if (!code || !state) return redirect('/?google_calendar=error&reason=missing_callback_parameters');

  try {
    await supabase.rpc('cleanup_old_oauth_states');

    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('owner_id, expires_at')
      .eq('state', state)
      .maybeSingle();
    if (stateError) throw stateError;
    if (!oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) {
      throw new Error('OAuth-State ungültig oder abgelaufen');
    }

    // State is single-use.
    await supabase.from('oauth_states').delete().eq('state', state);

    const redirectUri = `${functionsPublicUrl}/functions/v1/google-calendar-callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Google Token-Austausch fehlgeschlagen: ${tokenData.error ?? tokenRes.status}`);

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) throw new Error('Google-E-Mail konnte nicht gelesen werden');

    // Google may omit refresh_token when an account was already authorized.
    // In that case retain the existing Vault secret.
    const { data: existing } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token_secret_id')
      .eq('owner_id', oauthState.owner_id)
      .maybeSingle();

    let secretId = existing?.refresh_token_secret_id ?? null;
    if (refreshToken) {
      const { data, error: secretError } = await supabase.rpc('store_google_refresh_token', {
        p_secret_id: secretId,
        p_refresh_token: refreshToken,
      });
      if (secretError) throw secretError;
      secretId = data;
    }
    if (!secretId) throw new Error('Google hat keinen Refresh-Token geliefert. Bitte die Verbindung bei Google widerrufen und erneut verbinden.');

    const { error: connectionError } = await supabase
      .from('google_calendar_connections')
      .upsert({
        owner_id: oauthState.owner_id,
        google_email: profile.email,
        calendar_id: 'primary',
        refresh_token_secret_id: secretId,
        connected_at: new Date().toISOString(),
        sync_error: null,
      }, { onConflict: 'owner_id' });
    if (connectionError) throw connectionError;

    // Alle Google-Kalender des Nutzers holen (nicht nur "primary") —
    // Grundlage für den Mehrfach-Kalender-Sync unten UND die künftige
    // Auswahl-/Filter-UI. Default: neu gefundene Kalender sind
    // sync_enabled=true; der Nutzer kann später einzelne abwählen.
    const calendarListItems: Array<{ id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean }> = [];
    let clPageToken: string | undefined;
    do {
      const clParams = new URLSearchParams({ maxResults: '250' });
      if (clPageToken) clParams.set('pageToken', clPageToken);
      const clRes = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${clParams}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const clData = await clRes.json();
      if (!clRes.ok) throw new Error(`Kalenderliste konnte nicht geladen werden: ${clData.error?.message ?? clRes.status}`);
      calendarListItems.push(...(clData.items ?? []));
      clPageToken = clData.nextPageToken;
    } while (clPageToken);

    if (calendarListItems.length > 0) {
      const calendarRows = calendarListItems.map((c) => ({
        owner_id: oauthState.owner_id,
        google_calendar_id: c.id,
        summary: c.summaryOverride || c.summary || c.id,
        color: c.backgroundColor ?? null,
        is_primary: c.primary === true,
        sync_enabled: true,
      }));
      const { error: calListError } = await supabase
        .from('google_calendars')
        .upsert(calendarRows, { onConflict: 'owner_id,google_calendar_id' });
      if (calListError) throw calListError;
    }

    // First import immediately. The sync endpoint only accepts this internal
    // service-role authorization, so it cannot be triggered anonymously.
    const syncRes = await fetch(`${functionsPublicUrl}/functions/v1/google-calendar-sync?test_owner=${encodeURIComponent(oauthState.owner_id)}`, {
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!syncRes.ok) throw new Error(`Erstsynchronisierung fehlgeschlagen (${syncRes.status})`);

    return redirect('/?google_calendar=connected');
  } catch (err) {
    console.error('[google-calendar-callback]', err);
    return redirect(`/?google_calendar=error&reason=${encodeURIComponent(err instanceof Error ? err.message : 'unknown_error')}`);
  }
});
