// Supabase Edge Function "google-calendar-connect"
// =====================================================================
// Erster Schritt des Google-Calendar-Connect-Flows. Vom Frontend mit
// dem Bearer-Token des eingeloggten Nutzers aufgerufen (AppMenu.jsx →
// "Kalender verbinden"). Prüft den Token, legt einen kurzlebigen
// state-Eintrag an, gibt die Google-Consent-URL zurück. Das Frontend
// leitet den Browser dann per window.location.href dorthin weiter.
//
// WICHTIG: access_token dieser App sind ES256-signiert (siehe
// HOSTING.md, Abschnitt 13a), nicht HS256 — die Verifikation läuft
// über den EC-Key aus SUPABASE_JWKS, nicht über JWT_SECRET.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
const functionsPublicUrl = Deno.env.get('FUNCTIONS_PUBLIC_URL'); // z.B. https://api-staging.nestua.de

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ─── JWT-Verifikation (ES256, EC-Key aus SUPABASE_JWKS) ─────────────
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

    // Alte States aufräumen, dann neuen anlegen
    await supabase.rpc('cleanup_old_oauth_states');

    const state = crypto.randomUUID();
    const { error } = await supabase.from('oauth_states').insert({ state, owner_id: ownerId });
    if (error) throw error;

    const redirectUri = `${functionsPublicUrl}/functions/v1/google-calendar-callback`;
    const params = new URLSearchParams({
      client_id: googleClientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url: consentUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[google-calendar-connect]', err);
    return new Response(JSON.stringify({ error: err.message || 'Fehler' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
