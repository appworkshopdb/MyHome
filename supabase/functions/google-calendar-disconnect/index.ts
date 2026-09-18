import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Kein Token');
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: serviceRoleKey } });
  if (!res.ok) throw new Error('Nicht authentifiziert');
  const user = await res.json();
  if (!user?.id) throw new Error('Nicht authentifiziert');
  return user.id as string;
}

Deno.serve(async (req) => {
  try {
    const ownerId = await verifyUser(req);
    const { data: conn, error: readError } = await supabase
      .from('google_calendar_connections').select('refresh_token_secret_id').eq('owner_id', ownerId).maybeSingle();
    if (readError) throw readError;

    if (conn?.refresh_token_secret_id) {
      await supabase.rpc('delete_google_refresh_token', { p_secret_id: conn.refresh_token_secret_id });
    }
    await supabase.from('google_calendar_connections').delete().eq('owner_id', ownerId);
    await supabase.from('calendar_events').delete().eq('owner_id', ownerId).eq('source_module', 'google');

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[google-calendar-disconnect]', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Fehler' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
});
