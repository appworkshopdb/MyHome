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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Fehler der Anmeldung (→ 401) von Datenbankfehlern (→ 500) unterscheiden.
class AuthError extends Error {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function base64UrlToBytes(b64url: string) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyJwtAndGetOwnerId(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new AuthError('Kein Token übergeben');
  const token = authHeader.slice(7);
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new AuthError('Ungültiges Token-Format');

  // Fehlende Konfiguration ist ein Serverfehler, kein Anmeldefehler.
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

  let valid = false;
  let payload: { exp?: unknown; sub?: unknown; role?: unknown };
  try {
    const sig = base64UrlToBytes(sigB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sig, data);
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    throw new AuthError('Ungültiges Token');
  }
  if (!valid) throw new AuthError('Signatur ungültig');

  // exp ist Pflicht: ein Token ohne Ablauf würde sonst unbegrenzt gelten.
  if (typeof payload.exp !== 'number') throw new AuthError('Token ohne Ablaufzeit');
  if (payload.exp * 1000 < Date.now()) throw new AuthError('Token abgelaufen');
  // Nur angemeldete Nutzer (nicht anon, nicht service_role).
  if (payload.role !== 'authenticated') throw new AuthError('Falsche Rolle im Token');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new AuthError('Kein sub im Token');
  return payload.sub;
}

Deno.serve(async (req) => {
  let ownerId: string;
  try {
    ownerId = await verifyJwtAndGetOwnerId(req.headers.get('Authorization'));
  } catch (err) {
    console.error('[google-calendar-disconnect] Anmeldung', err);
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    return json({ error: 'Serverfehler' }, 500);
  }

  try {
    const { data: connection, error: readError } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token_secret_id')
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (readError) throw readError;

    if (connection) {
      // Erst den Vault-Secret löschen: schlägt das fehl, bleibt die Verbindungs-
      // Zeile mit der Secret-ID stehen und ein neuer Versuch kann aufräumen.
      if (connection.refresh_token_secret_id) {
        const { error: rpcError } = await supabase.rpc('delete_google_refresh_token', {
          p_secret_id: connection.refresh_token_secret_id,
        });
        if (rpcError) throw rpcError;
      }
      const { error: deleteError } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('owner_id', ownerId);
      if (deleteError) throw deleteError;
    }

    // Bereits gesyncte Google-Termine sofort weich löschen, statt bis
    // zum nächsten (dann nicht mehr laufenden) Sync zu warten.
    const { error: eventsError } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('source_module', 'google')
      .is('deleted_at', null);
    if (eventsError) throw eventsError;

    return json({ disconnected: true });
  } catch (err) {
    console.error('[google-calendar-disconnect] Datenbank', err);
    return json({ error: 'Trennen fehlgeschlagen' }, 500);
  }
});
