// Supabase Edge Function "google-calendar-disconnect"
// =====================================================================
// Vom Frontend mit Bearer-Token aufgerufen (AppMenu.jsx → "Trennen").
// Löscht den Vault-Secret und die Verbindungs-Zeile. Läuft server-
// seitig, weil das Löschen des Vault-Secrets nur service_role darf.
// Bereits synchronisierte Google-Termine in calendar_events bleiben
// bewusst stehen (weich gelöscht würden sie erst beim nächsten Sync,
// der dann keine Google-Events mehr findet) — für sofortiges Aufräumen
// werden sie hier direkt weich gelöscht.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, serviceRoleKey);

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyJwtAndGetOwnerId(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Kein Token übergeben');
  const token = authHeader.slice(7);
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Ungültiges Token-Format');

  const jwksRaw = Deno.env.get('SUPABASE_JWKS');
  if (!jwksRaw) throw new Error('JWKS nicht konfiguriert');
  const jwks = JSON.parse(jwksRaw);
  const ecKey = jwks.keys?.find((k: { kty: string }) => k.kty === 'EC');
  if (!ecKey) throw new Error('Kein EC-Key im JWKS gefunden');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: ecKey.kty, crv: ecKey.crv, x: ecKey.x, y: ecKey.y, ext: true, key_ops: ['verify'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const sig = base64UrlToBytes(sigB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sig, data);
  if (!valid) throw new Error('Signatur ungültig');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token abgelaufen');
  if (!payload.sub) throw new Error('Kein sub im Token');
  return payload.sub as string;
}

Deno.serve(async (req) => {
  try {
    const ownerId = await verifyJwtAndGetOwnerId(req.headers.get('Authorization'));

    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token_secret_id')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (connection) {
      await supabase.rpc('delete_google_refresh_token', { p_secret_id: connection.refresh_token_secret_id });
      await supabase.from('google_calendar_connections').delete().eq('owner_id', ownerId);
    }

    // Bereits gesyncte Google-Termine sofort weich löschen, statt bis
    // zum nächsten (dann nicht mehr laufenden) Sync zu warten.
    await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('source_module', 'google')
      .is('deleted_at', null);

    return new Response(JSON.stringify({ disconnected: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[google-calendar-disconnect]', err);
    return new Response(JSON.stringify({ error: err.message || 'Fehler' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
