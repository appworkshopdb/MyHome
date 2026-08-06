import { supabaseUrl, supabaseAnonKey, setAccessToken } from './supabaseClient';

const STORAGE_KEY = 'zuhause_session';

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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || 'Anfrage fehlgeschlagen');
  }
  return data;
}

export async function signInWithPassword(email, password) {
  const data = await authRequest('token?grant_type=password', { email, password });
  const session = withExpiry(data);
  persist(session);
  return session;
}

export async function signUp(email, password) {
  const data = await authRequest('signup', { email, password });
  // Falls "Confirm email" aktiv ist, kommt hier noch kein access_token
  // zurück — die Person muss erst die Bestätigungsmail nutzen.
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
