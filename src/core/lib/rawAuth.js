import { supabaseUrl, supabaseAnonKey, setAccessToken } from './supabaseClient';

// Der Schlüssel, unter dem die Sitzung im localStorage liegt. Wird von
// mehreren Modulen gelesen, die den owner_id-Claim aus dem Token ziehen
// (habData.js, shoData.js, habitsStore.js, gamificationData.js) — deshalb
// exportiert statt in jeder Datei als Zeichenkette wiederholt.
export const SESSION_STORAGE_KEY = 'nestua_session';
const STORAGE_KEY = SESSION_STORAGE_KEY;

// Umbenennung "Zuhause" → "Nestua": auf Geräten, die die App vorher schon
// benutzt haben, liegt die Sitzung noch unter dem alten Schlüssel. Einmalig
// umkopieren, sonst wäre nach dem Deploy jeder ausgeloggt. Läuft beim Import
// dieses Moduls, also bevor irgendjemand den Schlüssel liest.
// Kann entfernt werden, sobald alle Geräte die App einmal geöffnet hatten.
const LEGACY_STORAGE_KEY = 'zuhause_session';
try {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const alt = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (alt) localStorage.setItem(STORAGE_KEY, alt);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch { /* localStorage nicht verfügbar — dann gibt es auch nichts zu migrieren */ }

// Sicherheitsabstand: Token gilt intern schon "abgelaufen", wenn es
// weniger als 60s bis zum echten Ablauf sind. Verhindert, dass ein
// Request mit einem Token startet, das noch während der Anfrage abläuft.
export const REFRESH_MARGIN_MS = 60_000;

// Supabase liefert nur "expires_in" (Sekunden ab jetzt), keinen festen
// Zeitpunkt. Wir rechnen uns beim Empfang einen absoluten Zeitstempel
// aus, damit wir später (auch nach Browser-Neustart) wissen, wann
// wirklich erneuert werden muss.
function withExpiry(session) {
  return { ...session, expires_at: Date.now() + session.expires_in * 1000 };
}

function persist(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAccessToken(session.access_token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
  }
}

// Beim App-Start: gespeicherte Sitzung laden und dem Datenbank-Client
// sofort bekannt machen (siehe setAccessToken in supabaseClient.js).
export function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    setAccessToken(session.access_token);
    return session;
  } catch {
    return null;
  }
}

async function authRequest(path, body) {
  const res = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body: JSON.stringify(body),
  });
  // /resend antwortet je nach GoTrue-Version mit leerem Body → tolerant parsen.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.msg || data.error || 'Anfrage fehlgeschlagen');
    err.code = data.error_code || data.code || null; // z. B. 'email_not_confirmed'
    throw err;
  }
  return data;
}

// Wohin der Link in der Bestätigungsmail zurückführt: die App selbst.
// GoTrue akzeptiert das nur, wenn die URL in GOTRUE_URI_ALLOW_LIST steht
// (sonst fällt es auf SITE_URL zurück) — siehe HOSTING.md.
function confirmRedirect() {
  return encodeURIComponent(window.location.origin + window.location.pathname);
}

export async function signInWithPassword(email, password) {
  const data = await authRequest('token?grant_type=password', { email, password });
  const session = withExpiry(data);
  persist(session);
  return session;
}

export async function signUp(email, password) {
  const data = await authRequest(`signup?redirect_to=${confirmRedirect()}`, { email, password });
  // Mit aktivem "Confirm email" kommt hier KEIN access_token zurück — die
  // Person muss erst die Bestätigungsmail nutzen. Bei bereits registrierter
  // (bestätigter) Adresse antwortet GoTrue absichtlich genauso, damit sich
  // nicht erraten lässt, welche Adressen ein Konto haben.
  if (data.access_token) {
    const session = withExpiry(data);
    persist(session);
    return session;
  }
  return data;
}

// Erneuert die Sitzung über den refresh_token-Grant. Läuft über denselben
// HTTP-Weg wie Login/Signup (siehe Workaround-Hinweis oben) — der kaputte
// auth-js-Mechanismus wird also auch beim Refresh nicht angerührt.
export async function refreshSession(refreshToken) {
  const data = await authRequest('token?grant_type=refresh_token', {
    refresh_token: refreshToken,
  });
  const session = withExpiry(data);
  persist(session);
  return session;
}

export function signOut() {
  persist(null);
}

// Passwort ändern — läuft über PUT /auth/v1/user (GoTrue REST-API),
// authentifiziert mit dem aktuellen Access-Token. Bewusst nicht über
// supabase.auth.updateUser(), aus demselben Grund wie beim Rest dieser
// Datei: der navigator.locks-Bug (siehe Workaround-Hinweis oben).
export async function updatePassword(session, newPassword) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || 'Passwort konnte nicht geändert werden');
  }
  return data;
}

// Bestätigungsmail nochmal senden (Cooldown/Rate-Limit erzwingt GoTrue).
export function resendConfirmation(email) {
  return authRequest(`resend?redirect_to=${confirmRedirect()}`, { type: 'signup', email });
}

// „Passwort vergessen“: GoTrue schickt einen Link, der mit #…&type=recovery in die
// App zurückführt (consumeAuthRedirect) — dort legt die Person ein neues Passwort
// fest (ResetPassword.jsx). GoTrue antwortet bewusst gleich, egal ob es die Adresse gibt.
export function requestPasswordReset(email) {
  return authRequest(`recover?redirect_to=${confirmRedirect()}`, { email });
}

// ── Rückkehr über den Link aus der Bestätigungsmail ─────────────────
// GoTrue leitet auf  <redirect_to>#access_token=…&refresh_token=…&type=signup
// (bzw. #error=…&error_code=otp_expired) zurück. Die App nutzt aber
// Hash-Routing (#/profile …), also muss dieser Hash VOR dem ersten Render
// weg — sonst hält useRoute die Tokens für eine Modul-Id. Deshalb wird er
// synchron beim Import gelesen und sofort durch #/ ersetzt; die eigentliche
// Verarbeitung (async: Nutzer nachladen) macht consumeAuthRedirect().
let pendingRedirect = null;
try {
  const h = window.location.hash;
  if (/^#(access_token|error)/.test(h)) {
    pendingRedirect = new URLSearchParams(h.slice(1));
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
  }
} catch { /* kein window (Tests/SSR) */ }

// → null (kein Redirect) | { session } | { error: 'deutscher Text' }
// Das Promise wird gemerkt: React StrictMode (Dev) führt Effects doppelt
// aus, der zweite Aufruf muss dasselbe Ergebnis bekommen statt „nichts“.
let redirectResult = null;
export function consumeAuthRedirect() {
  if (!redirectResult) redirectResult = processRedirect(pendingRedirect);
  return redirectResult;
}

async function processRedirect(p) {
  if (!p) return null;

  if (p.get('error') || !p.get('access_token')) {
    return {
      error: p.get('error_code') === 'otp_expired'
        ? 'Der Bestätigungslink ist abgelaufen oder wurde schon benutzt. Melde dich an — falls die Adresse noch nicht bestätigt ist, kannst du dort eine neue Mail anfordern.'
        : 'Die Bestätigung hat nicht geklappt. Bitte melde dich an oder fordere eine neue Mail an.',
    };
  }

  const accessToken = p.get('access_token');
  try {
    // Der Link enthält nur die Tokens, nicht den Nutzer — App und RLS
    // brauchen aber session.user (id, email, created_at).
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    });
    const user = await res.json();
    if (!res.ok) throw new Error('user');
    const session = withExpiry({
      access_token: accessToken,
      refresh_token: p.get('refresh_token'),
      expires_in: Number(p.get('expires_in')) || 3600,
      token_type: 'bearer',
      user,
    });
    persist(session);
    return { session, type: p.get('type') }; // 'signup' | 'recovery' | …
  } catch {
    return { error: 'E-Mail bestätigt, aber die Anmeldung ist fehlgeschlagen. Bitte melde dich mit deinem Passwort an.' };
  }
}
